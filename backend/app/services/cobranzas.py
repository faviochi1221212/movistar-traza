"""Agente de Cobranzas: cartera, gestiones, promesas y clasificacion de correos.

Gestion de Cobranza responde que debemos cobrar (cartera real).
Bandeja IA responde que dice el cliente (comunicaciones + Dify).
Casos de Cobranza responde que excepcion necesita intervencion.
"""
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core import orchestrator
from app.integrations.dify import get_dify_classifier, normalizar_clasificacion
from app.models.models import (
    CasoCobranza, ClienteB2B, EmailCobranza, FacturaB2B, GestionCobranza,
    MLPrediction, PromesaPago,
)
from app.services import audit
from app.services.rules import get_regla


def obtener_cartera(db: Session, estado: str | None = None, limit: int = 100, offset: int = 0):
    sql = "SELECT * FROM public.v_cartera_cobranza"
    if estado and estado != "TODOS":
        sql += " WHERE aging = :estado"
    sql += " ORDER BY dias_vencidos DESC LIMIT :limit OFFSET :offset"
    params = {"limit": limit, "offset": offset}
    if estado and estado != "TODOS":
        params["estado"] = estado
    return db.execute(text(sql), params).mappings().all()


def resumen_cartera(db: Session) -> dict:
    row = db.execute(text(
        "SELECT COALESCE(SUM(saldo_pendiente),0) AS pendiente, "
        "COALESCE(SUM(saldo_pendiente) FILTER (WHERE aging <> 'POR_VENCER'), 0) AS vencida, "
        "COUNT(*) AS facturas FROM public.v_cartera_cobranza"
    )).mappings().first()

    facturado_total = db.execute(text("SELECT COALESCE(SUM(monto),0) FROM public.facturas_b2b WHERE estado = 'EMITIDO'")).scalar() or 0
    pagado_total = db.execute(text("SELECT COALESCE(SUM(monto_aplicado),0) FROM public.aplicaciones_pago")).scalar() or 0
    ratio_cobrado = float(pagado_total) / float(facturado_total) if facturado_total else 0.0

    riesgo_alto = db.query(MLPrediction).filter(MLPrediction.nivel_riesgo == "ALTO").count()

    return {
        "cartera_pendiente": float(row["pendiente"]),
        "cartera_vencida": float(row["vencida"]),
        "facturas_en_cartera": row["facturas"],
        "ratio_cobrado_facturado": round(ratio_cobrado, 4),
        "clientes_riesgo_alto": riesgo_alto,
    }


def registrar_gestion(db: Session, factura: FacturaB2B, *, notas: str | None = None, prioridad: str | None = None) -> GestionCobranza:
    gestion = db.query(GestionCobranza).filter(GestionCobranza.factura_id == factura.id).first()
    if not gestion:
        gestion = GestionCobranza(cliente_id=factura.cliente_id, factura_id=factura.id, estado="EN_GESTION")
        db.add(gestion)
    if notas:
        gestion.notas = notas
    if prioridad:
        gestion.prioridad = prioridad
    gestion.estado = "EN_GESTION" if gestion.estado == "PENDIENTE" else gestion.estado
    gestion.fecha_ultima_gestion = datetime.now(timezone.utc)
    db.flush()
    traza = orchestrator.get_or_create_traza(db, factura.cliente_id, factura.id)
    audit.log(db, actor_tipo="USER", accion="REGISTRAR_GESTION_COBRANZA", entidad_tipo="gestiones_cobranza",
               entidad_id=gestion.id, trace_id=traza.id)
    return gestion


def registrar_promesa_pago(db: Session, factura: FacturaB2B, monto: Decimal, fecha_prometida, origen: str = "MANUAL") -> PromesaPago:
    gestion = registrar_gestion(db, factura)
    gestion.estado = "PROMESA_PAGO"
    promesa = PromesaPago(
        gestion_id=gestion.id, cliente_id=factura.cliente_id, factura_id=factura.id,
        monto_prometido=monto, fecha_prometida=fecha_prometida, origen=origen, estado="VIGENTE",
    )
    db.add(promesa)
    db.flush()
    traza = orchestrator.get_or_create_traza(db, factura.cliente_id, factura.id)
    audit.log(db, actor_tipo="USER", accion="REGISTRAR_PROMESA_PAGO", entidad_tipo="promesas_pago",
               entidad_id=promesa.id, trace_id=traza.id)
    return promesa


def detectar_promesas_incumplidas(db: Session) -> int:
    hoy = datetime.now(timezone.utc).date()
    vencidas = db.query(PromesaPago).filter(PromesaPago.estado == "VIGENTE", PromesaPago.fecha_prometida < hoy).all()
    for p in vencidas:
        p.estado = "INCUMPLIDA"
        _crear_caso_cobranza(
            db, cliente_id=p.cliente_id, factura_id=p.factura_id, tipo_caso="PROMESA_INCUMPLIDA",
            descripcion=f"Promesa de pago por {p.monto_prometido} vencida el {p.fecha_prometida}.",
            impacto_monto=p.monto_prometido, prioridad="ALTA",
        )
    db.flush()
    return len(vencidas)


def _crear_caso_cobranza(db: Session, *, cliente_id, factura_id=None, email_id=None, tipo_caso, descripcion, impacto_monto=None, prioridad="MEDIA") -> CasoCobranza:
    codigo = f"CC-{cliente_id.hex[:8]}-{tipo_caso[:4]}-{int(datetime.now(timezone.utc).timestamp())}"
    caso = CasoCobranza(
        codigo=codigo, cliente_id=cliente_id, factura_id=factura_id, email_id=email_id,
        tipo_caso=tipo_caso, descripcion=descripcion, impacto_monto=impacto_monto, prioridad=prioridad,
    )
    db.add(caso)
    db.flush()
    traza = orchestrator.get_or_create_traza(db, cliente_id, factura_id)
    audit.log(db, actor_tipo="AGENT", actor_id="COBRANZAS", accion="CREAR_CASO_COBRANZA",
               entidad_tipo="casos_cobranza", entidad_id=caso.id, after_data={"tipo_caso": tipo_caso},
               trace_id=traza.id)
    return caso


def clasificar_email(db: Session, email: EmailCobranza) -> EmailCobranza:
    cliente = db.query(ClienteB2B).get(email.cliente_id) if email.cliente_id else None
    raw = get_dify_classifier().clasificar_correo(cliente.razon_social if cliente else None, email.asunto or "", email.cuerpo or "")
    if raw is None:
        email.procesado = False
        db.flush()
        return email

    normalizado = normalizar_clasificacion(raw)
    email.clasificacion = normalizado["clasificacion"]
    email.campos_extraidos = normalizado["campos_extraidos"]
    email.confianza = normalizado["confianza"]
    email.procesado = True
    db.flush()

    # email.cliente_id puede ser None si Dify no logro vincular el correo a
    # un cliente conocido: en ese caso no hay una traza logica a la que
    # atar el evento (seccion "si no existe un ID de traza logico").
    traza_id = orchestrator.get_or_create_traza(db, email.cliente_id, email.factura_id).id if email.cliente_id else None
    audit.log(db, actor_tipo="AGENT", actor_id="COBRANZAS", accion="CLASIFICAR_EMAIL",
               entidad_tipo="emails_cobranza", entidad_id=email.id, after_data=normalizado, trace_id=traza_id)

    if normalizado["clasificacion"] in ("RECLAMO", "CONSULTA", "NOTA_CREDITO") and email.cliente_id:
        _crear_caso_cobranza(
            db, cliente_id=email.cliente_id, factura_id=email.factura_id, email_id=email.id,
            tipo_caso=normalizado["clasificacion"], descripcion=email.asunto,
            prioridad="ALTA" if normalizado["clasificacion"] == "RECLAMO" else "MEDIA",
        )
    return email


def corregir_clasificacion(db: Session, email: EmailCobranza, nueva_clasificacion: str, usuario: str | None = None) -> EmailCobranza:
    anterior = email.clasificacion
    email.clasificacion = nueva_clasificacion
    db.flush()
    traza_id = orchestrator.get_or_create_traza(db, email.cliente_id, email.factura_id).id if email.cliente_id else None
    audit.log(db, actor_tipo="USER", actor_id=usuario, accion="CORREGIR_CLASIFICACION_EMAIL",
               entidad_tipo="emails_cobranza", entidad_id=email.id,
               before_data={"clasificacion": anterior}, after_data={"clasificacion": nueva_clasificacion},
               trace_id=traza_id)
    return email
