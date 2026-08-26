"""BI y Recupero: KPIs, riesgo predictivo y oportunidades. Solo analiza, no gestiona tareas."""
from datetime import datetime, timezone

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.ml.predictor import get_predictor, nivel_riesgo
from app.models.models import ClienteB2B, MLPrediction
from app.services import audit
from app.services.rules import get_regla

STATS_SQL = text("""
WITH pagos_cliente AS (
  SELECT p.cliente_id, p.fecha_pago, f.fecha_vencimiento, ap.monto_aplicado
  FROM public.aplicaciones_pago ap
  JOIN public.pagos_b2b p ON p.id = ap.pago_id
  JOIN public.facturas_b2b f ON f.id = ap.factura_id
),
agg_pagos AS (
  SELECT cliente_id,
         COUNT(*) AS cantidad_pagos,
         COALESCE(SUM(monto_aplicado), 0) AS monto_pagado,
         AVG(GREATEST(fecha_pago - fecha_vencimiento, 0)) AS dias_mora_promedio,
         MAX(GREATEST(fecha_pago - fecha_vencimiento, 0)) AS dias_mora_maximo
  FROM pagos_cliente
  GROUP BY cliente_id
),
agg_facturas AS (
  SELECT cliente_id, COUNT(*) AS cantidad_facturas, COALESCE(SUM(monto), 0) AS monto_facturado
  FROM public.facturas_b2b
  WHERE estado = 'EMITIDO'
  GROUP BY cliente_id
)
SELECT
  c.id AS cliente_id,
  COALESCE(af.monto_facturado, 0) AS monto_total_facturado,
  COALESCE(af.cantidad_facturas, 0) AS cantidad_facturas,
  COALESCE(ap.cantidad_pagos, 0) AS cantidad_pagos,
  CASE WHEN COALESCE(af.monto_facturado, 0) > 0
       THEN COALESCE(ap.monto_pagado, 0) / af.monto_facturado ELSE 0 END AS ratio_pago_historico,
  COALESCE(ap.dias_mora_promedio, 0) AS dias_mora_promedio,
  COALESCE(ap.dias_mora_maximo, 0) AS dias_mora_maximo
FROM public.clientes_b2b c
LEFT JOIN agg_facturas af ON af.cliente_id = c.id
LEFT JOIN agg_pagos ap ON ap.cliente_id = c.id
WHERE c.activo IS TRUE AND COALESCE(af.cantidad_facturas, 0) > 0
""")


def calcular_stats_clientes(db: Session):
    return db.execute(STATS_SQL).mappings().all()


def recalcular_riesgo(db: Session, limit: int | None = None) -> int:
    """Ejecuta el modelo .pkl real sobre las features calculadas desde datos reales."""
    predictor = get_predictor()
    if predictor is None:
        return 0
    riesgo_bajo_min = float(get_regla(db, "RIESGO_PAGO_BAJO_MIN") or 0.90)
    riesgo_medio_min = float(get_regla(db, "RIESGO_PAGO_MEDIO_MIN") or 0.30)

    rows = calcular_stats_clientes(db)
    if limit:
        rows = rows[:limit]
    creados = 0
    for row in rows:
        proba = predictor.predict_proba(dict(row))
        if proba is None:
            continue
        nivel = nivel_riesgo(proba, riesgo_bajo_min, riesgo_medio_min)
        pred = MLPrediction(
            cliente_id=row["cliente_id"], modelo_nombre="modelo_riesgo_cliente_traza",
            probabilidad_pago=round(proba, 5), nivel_riesgo=nivel,
            features={k: (float(v) if hasattr(v, "__float__") else v) for k, v in dict(row).items() if k != "cliente_id"},
        )
        db.add(pred)
        creados += 1
    db.flush()
    if creados:
        audit.log(db, actor_tipo="SYSTEM", accion="RECALCULAR_RIESGO_ML", metadata={"clientes_procesados": creados})
    return creados


def riesgo_resumen(db: Session) -> dict:
    """Solo cuenta clientes con al menos una factura real: un cliente sin
    historial de facturacion no es un "riesgo evaluado", es un caso de
    NO_DISPONIBLE (seccion 23 del prompt maestro) que se muestra aparte."""
    dist = db.execute(text("""
        SELECT r.nivel_riesgo, COUNT(*)
        FROM public.v_ml_riesgo_actual r
        WHERE EXISTS (SELECT 1 FROM public.facturas_b2b f WHERE f.cliente_id = r.cliente_id)
        GROUP BY r.nivel_riesgo
    """)).all()
    distribucion = {"BAJO": 0, "MEDIO": 0, "ALTO": 0}
    for nivel, cnt in dist:
        distribucion[nivel] = cnt

    sin_historial = db.execute(text("""
        SELECT COUNT(*) FROM public.clientes_b2b c
        WHERE c.activo IS TRUE
          AND NOT EXISTS (SELECT 1 FROM public.facturas_b2b f WHERE f.cliente_id = c.id)
    """)).scalar() or 0

    return {"distribucion": distribucion, "total_evaluados": sum(distribucion.values()), "sin_historial": sin_historial}


def top_riesgo(db: Session, limit: int = 20, nivel_riesgo: str | None = None):
    sql = """
        SELECT r.cliente_id, c.razon_social, r.probabilidad_pago, r.nivel_riesgo, r.predicted_at,
               COALESCE(fs.saldo_total, 0) AS saldo_pendiente, COALESCE(fs.dias_max, 0) AS dias_vencidos
        FROM public.v_ml_riesgo_actual r
        JOIN public.clientes_b2b c ON c.id = r.cliente_id
        LEFT JOIN (
            SELECT cliente_id, SUM(saldo_pendiente) AS saldo_total, MAX(dias_vencidos) AS dias_max
            FROM public.v_cartera_cobranza GROUP BY cliente_id
        ) fs ON fs.cliente_id = r.cliente_id
        WHERE EXISTS (SELECT 1 FROM public.facturas_b2b f WHERE f.cliente_id = r.cliente_id)
    """
    params: dict = {"limit": limit}
    if nivel_riesgo and nivel_riesgo != "TODOS":
        sql += " AND r.nivel_riesgo = :nivel_riesgo"
        params["nivel_riesgo"] = nivel_riesgo
    sql += " ORDER BY saldo_pendiente DESC, dias_vencidos DESC LIMIT :limit"
    return db.execute(text(sql), params).mappings().all()


def oportunidades_recupero(db: Session, limit: int = 30, prioridad: str | None = None):
    """saldo pendiente + aging + riesgo + facturas incumplidas -> prioridad de recupero.

    La prioridad se deriva en Python (no es una columna), asi que si se pide
    filtrar por ella se trae un universo mas amplio de la query SQL y se
    recorta a `limit` DESPUES de filtrar, no antes."""
    sql = text("""
        SELECT
          v.cliente_id, c.razon_social,
          SUM(v.saldo_pendiente) AS saldo_pendiente,
          MAX(v.dias_vencidos) AS dias_vencidos,
          COUNT(*) AS facturas_vencidas,
          COALESCE(r.probabilidad_pago, 0.5) AS probabilidad_pago,
          COALESCE(r.nivel_riesgo, 'MEDIO') AS nivel_riesgo
        FROM public.v_cartera_cobranza v
        JOIN public.clientes_b2b c ON c.id = v.cliente_id
        LEFT JOIN public.v_ml_riesgo_actual r ON r.cliente_id = v.cliente_id
        GROUP BY v.cliente_id, c.razon_social, r.probabilidad_pago, r.nivel_riesgo
        ORDER BY (SUM(v.saldo_pendiente) * (1 - COALESCE(r.probabilidad_pago, 0.5)) * (1 + MAX(v.dias_vencidos) / 90.0)) DESC
        LIMIT :limit
    """)
    query_limit = limit * 5 if prioridad and prioridad != "TODOS" else limit
    rows = db.execute(sql, {"limit": query_limit}).mappings().all()
    mora_critica_dias = float(get_regla(db, "MORA_CRITICA_DIAS") or 60)

    oportunidades = []
    for row in rows:
        if row["dias_vencidos"] >= mora_critica_dias and row["nivel_riesgo"] == "ALTO":
            p, tipo, accion = "Alta", "Regularizacion de saldo vencido", "Evaluar acuerdo de regularizacion"
        elif row["nivel_riesgo"] == "ALTO":
            p, tipo, accion = "Alta", "Renegociacion preventiva", "Evaluar plan de pagos personalizado"
        elif row["dias_vencidos"] >= 30:
            p, tipo, accion = "Media", "Seguimiento prioritario", "Contacto por deuda vencida"
        else:
            p, tipo, accion = "Baja", "Prevencion de mora", "Recordatorio preventivo"
        if prioridad and prioridad != "TODOS" and p != prioridad:
            continue
        oportunidades.append({**dict(row), "prioridad": p, "oportunidad": tipo, "accion_sugerida": accion})
    return oportunidades[:limit]


def resumen_general(db: Session) -> dict:
    facturado = db.execute(text("SELECT COALESCE(SUM(monto),0) FROM public.facturas_b2b WHERE estado='EMITIDO'")).scalar() or 0
    cartera = db.execute(text("SELECT COALESCE(SUM(saldo_pendiente),0) FROM public.v_facturas_saldo WHERE estado_facturacion='EMITIDO'")).scalar() or 0
    vencida = db.execute(text("SELECT COALESCE(SUM(saldo_pendiente),0) FROM public.v_cartera_cobranza WHERE aging <> 'POR_VENCER'")).scalar() or 0
    pagado = db.execute(text("SELECT COALESCE(SUM(monto_aplicado),0) FROM public.aplicaciones_pago")).scalar() or 0

    conciliadas = db.execute(text("SELECT metodo, COUNT(*) FROM public.conciliaciones WHERE estado='CONCILIADO' GROUP BY metodo")).all()
    conc = {"AUTOMATICO": 0, "MANUAL": 0}
    for metodo, cnt in conciliadas:
        conc[metodo] = cnt

    movimientos_pendientes = db.execute(text("SELECT COUNT(*) FROM public.movimientos_bancarios_demo WHERE estado IN ('PENDIENTE','IDENTIFICADO')")).scalar() or 0

    return {
        "facturacion": {"monto_facturado": float(facturado)},
        "cobranzas": {"cartera_pendiente": float(cartera), "cartera_vencida": float(vencida)},
        "recaudo": {
            "conciliaciones_automaticas": conc["AUTOMATICO"], "conciliaciones_manuales": conc["MANUAL"],
            "movimientos_pendientes": movimientos_pendientes, "monto_pagado_aplicado": float(pagado),
        },
    }
