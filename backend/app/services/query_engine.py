"""Motor generico de periodo + operacion para 'Preguntar a TRAZA'.

Version en Python del mismo patron que ya usan los copilotos de Facturacion,
Cobranzas y BI en el frontend (`react-export/src/lib/queryEngine.ts`): se
reconoce un periodo ("agosto", "este mes", "ultimos 30 dias") y una operacion
(contar, sumar, promediar, top-N, maximo, minimo) en la pregunta, y se calcula
sobre datos reales de Supabase -- nunca sobre un numero inventado por el LLM.

Este modulo solo CALCULA. `asistente.responder()` decide cuando usarlo y le
pasa el resultado a Dify unicamente para redactarlo en lenguaje natural.
"""
import re
from calendar import monthrange
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import text
from sqlalchemy.orm import Session

MESES = {
    "enero": 1, "febrero": 2, "marzo": 3, "abril": 4, "mayo": 5, "junio": 6,
    "julio": 7, "agosto": 8, "septiembre": 9, "setiembre": 9, "octubre": 10,
    "noviembre": 11, "diciembre": 12,
}


def _fmt_monto(v) -> str:
    return f"S/ {float(v or 0):,.2f}"


def _ultimo_dia_mes(anio: int, mes: int) -> int:
    return monthrange(anio, mes)[1]


def parsear_periodo(texto: str, hoy: date | None = None) -> dict | None:
    """Devuelve {desde, hasta, etiqueta} o None si la pregunta no menciona periodo
    (en cuyo caso se calcula sobre todo el historico)."""
    t = texto.lower()
    hoy = hoy or datetime.now(timezone.utc).date()

    if re.search(r"\bhoy\b", t):
        return {"desde": hoy, "hasta": hoy, "etiqueta": "hoy"}
    if re.search(r"\bayer\b", t):
        d = hoy - timedelta(days=1)
        return {"desde": d, "hasta": d, "etiqueta": "ayer"}
    if re.search(r"esta semana", t):
        desde = hoy - timedelta(days=hoy.weekday())
        return {"desde": desde, "hasta": hoy, "etiqueta": "esta semana"}
    if re.search(r"semana pasada|la semana anterior", t):
        fin_semana_actual = hoy - timedelta(days=hoy.weekday())
        desde = fin_semana_actual - timedelta(days=7)
        hasta = fin_semana_actual - timedelta(days=1)
        return {"desde": desde, "hasta": hasta, "etiqueta": "la semana pasada"}
    if re.search(r"el mes pasado|mes anterior", t):
        primer_dia_mes_actual = hoy.replace(day=1)
        hasta = primer_dia_mes_actual - timedelta(days=1)
        desde = hasta.replace(day=1)
        return {"desde": desde, "hasta": hasta, "etiqueta": "el mes pasado"}
    if re.search(r"este mes|mes actual", t):
        desde = hoy.replace(day=1)
        hasta = hoy.replace(day=_ultimo_dia_mes(hoy.year, hoy.month))
        return {"desde": desde, "hasta": hasta, "etiqueta": "este mes"}
    if re.search(r"el a[ñn]o pasado|a[ñn]o anterior", t):
        anio = hoy.year - 1
        return {"desde": date(anio, 1, 1), "hasta": date(anio, 12, 31), "etiqueta": f"el {anio}"}
    if re.search(r"este a[ñn]o|a[ñn]o actual", t):
        return {"desde": date(hoy.year, 1, 1), "hasta": date(hoy.year, 12, 31), "etiqueta": f"el {hoy.year}"}

    m = re.search(r"[uú]ltimos?\s+(\d+)\s+d[ií]as", t)
    if m:
        n = int(m.group(1))
        desde = hoy - timedelta(days=n - 1)
        return {"desde": desde, "hasta": hoy, "etiqueta": f"los ultimos {n} dias"}

    m = re.search(r"[uú]ltimos?\s+(\d+)\s+mes(es)?", t)
    if m:
        n = int(m.group(1))
        anio, mes = hoy.year, hoy.month - (n - 1)
        while mes <= 0:
            mes += 12
            anio -= 1
        desde = date(anio, mes, 1)
        return {"desde": desde, "hasta": hoy, "etiqueta": f"los ultimos {n} meses"}

    m = re.search(r"\b(" + "|".join(MESES.keys()) + r")\b(?:\s+(?:de\s+)?(\d{4}))?", t)
    if m:
        mes = MESES[m.group(1)]
        anio = int(m.group(2)) if m.group(2) else hoy.year
        desde = date(anio, mes, 1)
        hasta = date(anio, mes, _ultimo_dia_mes(anio, mes))
        return {"desde": desde, "hasta": hasta, "etiqueta": f"{m.group(1)} {anio}"}

    return None


def detectar_operacion(texto: str) -> dict | None:
    t = texto.lower()
    m = re.search(r"top\s*(\d+)", t)
    if m:
        return {"tipo": "top", "n": int(m.group(1))}
    if re.search(r"\btop\b|ranking|m[aá]s cr[ií]tic|mayores clientes|principales clientes", t):
        return {"tipo": "top", "n": 5}
    if re.search(r"promedio|en promedio|promediar", t):
        return {"tipo": "promediar"}
    if re.search(r"m[aá]ximo|\bmayor\b|m[aá]s alt[ao]\b", t):
        return {"tipo": "maximo"}
    if re.search(r"m[ií]nimo|\bmenor\b|m[aá]s baj[ao]\b", t):
        return {"tipo": "minimo"}
    if re.search(r"cu[aá]nt[oa]s\b", t):
        return {"tipo": "contar"}
    if re.search(r"cu[aá]nto\b|\bsuma\b|\btotal\b|sumar", t):
        return {"tipo": "sumar"}
    return None


def detectar_dataset(texto: str) -> str | None:
    t = texto.lower()
    if re.search(r"caso.*factur|factur.*caso", t):
        return "casos_facturacion"
    if re.search(r"caso.*cobranz|cobranz.*caso", t):
        return "casos_cobranza"
    if re.search(r"correo|comunicaci|email", t):
        return "comunicaciones"
    if re.search(r"cr[ií]tic|cliente.*riesgo|riesgo.*cliente|\briesgo\b", t):
        return "riesgo"
    if re.search(r"cartera|vencid|saldo pendiente|\bmora\b", t):
        return "cartera"
    if re.search(r"concili|movimiento\s+banc|\bcobrado\b|\brecaudad", t):
        return "movimientos"
    if re.search(r"\bcobranzas?\b|gesti[oó]n(es)?\s+de\s+cobranza", t):
        return "gestiones_cobranza"
    if re.search(r"factur", t):
        return "facturas"
    return None


def _resolver_facturas(db: Session, periodo: dict | None, operacion: dict) -> tuple[str, dict] | None:
    where = "WHERE 1=1"
    params: dict = {}
    if periodo:
        where += " AND f.fecha_emision BETWEEN :desde AND :hasta"
        params.update(desde=periodo["desde"], hasta=periodo["hasta"])
    etiqueta = periodo["etiqueta"] if periodo else "todo el historico"
    tipo = operacion["tipo"]

    if tipo == "contar":
        n = db.execute(text(f"SELECT COUNT(*) FROM public.facturas_b2b f {where}"), params).scalar() or 0
        return f"Hubo {n} facturas emitidas en {etiqueta}.", {"cantidad": n, "periodo": etiqueta}
    if tipo == "sumar":
        s = db.execute(text(f"SELECT COALESCE(SUM(f.monto),0) FROM public.facturas_b2b f {where}"), params).scalar() or 0
        return f"El monto total facturado en {etiqueta} es {_fmt_monto(s)}.", {"monto_total": float(s), "periodo": etiqueta}
    if tipo == "promediar":
        row = db.execute(text(f"SELECT COUNT(*), COALESCE(AVG(f.monto),0) FROM public.facturas_b2b f {where}"), params).first()
        n, avg = row[0] or 0, row[1] or 0
        if n == 0:
            return f"No hay facturas registradas en {etiqueta}.", {"cantidad": 0, "periodo": etiqueta}
        return f"El monto promedio por factura en {etiqueta} es {_fmt_monto(avg)} (sobre {n} facturas).", {"promedio": float(avg), "cantidad": n, "periodo": etiqueta}
    if tipo in ("maximo", "minimo"):
        orden = "DESC" if tipo == "maximo" else "ASC"
        row = db.execute(text(
            f"SELECT f.numero, c.razon_social, f.monto, f.fecha_emision FROM public.facturas_b2b f "
            f"JOIN public.clientes_b2b c ON c.id = f.cliente_id {where} ORDER BY f.monto {orden} LIMIT 1"
        ), params).mappings().first()
        if not row:
            return f"No hay facturas registradas en {etiqueta}.", {"periodo": etiqueta}
        calif = "mayor" if tipo == "maximo" else "menor"
        return (f"La factura de {calif} monto en {etiqueta} es {row['numero']} de {row['razon_social']}, por {_fmt_monto(row['monto'])}.",
                {"numero": row["numero"], "cliente": row["razon_social"], "monto": float(row["monto"]), "periodo": etiqueta})
    if tipo == "top":
        n = operacion.get("n") or 5
        rows = db.execute(text(
            f"SELECT c.razon_social, SUM(f.monto) AS total, COUNT(*) AS cantidad FROM public.facturas_b2b f "
            f"JOIN public.clientes_b2b c ON c.id = f.cliente_id {where} "
            f"GROUP BY c.razon_social ORDER BY total DESC LIMIT :n"
        ), {**params, "n": n}).mappings().all()
        if not rows:
            return f"No hay facturas registradas en {etiqueta}.", {"periodo": etiqueta}
        lineas = [f"{i+1}. {r['razon_social']} — {_fmt_monto(r['total'])} ({r['cantidad']} facturas)" for i, r in enumerate(rows)]
        return (f"Top {len(rows)} clientes por monto facturado en {etiqueta}: " + "; ".join(lineas) + ".",
                {"top": [dict(r) for r in rows], "periodo": etiqueta})
    return None


def _resolver_movimientos(db: Session, periodo: dict | None, operacion: dict) -> tuple[str, dict] | None:
    where = "WHERE m.estado = 'CONCILIADO'"
    params: dict = {}
    if periodo:
        where += " AND m.fecha_movimiento::date BETWEEN :desde AND :hasta"
        params.update(desde=periodo["desde"], hasta=periodo["hasta"])
    etiqueta = periodo["etiqueta"] if periodo else "todo el historico"
    tipo = operacion["tipo"]

    if tipo == "contar":
        n = db.execute(text(f"SELECT COUNT(*) FROM public.movimientos_bancarios_demo m {where}"), params).scalar() or 0
        return f"Hubo {n} movimientos conciliados en {etiqueta}.", {"cantidad": n, "periodo": etiqueta}
    if tipo == "sumar":
        s = db.execute(text(f"SELECT COALESCE(SUM(m.monto),0) FROM public.movimientos_bancarios_demo m {where}"), params).scalar() or 0
        return f"Se ha conciliado {_fmt_monto(s)} en {etiqueta}.", {"monto_total": float(s), "periodo": etiqueta}
    if tipo == "promediar":
        row = db.execute(text(f"SELECT COUNT(*), COALESCE(AVG(m.monto),0) FROM public.movimientos_bancarios_demo m {where}"), params).first()
        n, avg = row[0] or 0, row[1] or 0
        if n == 0:
            return f"No hay movimientos conciliados en {etiqueta}.", {"cantidad": 0, "periodo": etiqueta}
        return f"El monto promedio por movimiento conciliado en {etiqueta} es {_fmt_monto(avg)} (sobre {n} movimientos).", {"promedio": float(avg), "cantidad": n, "periodo": etiqueta}
    if tipo == "top":
        # Los movimientos bancarios no traen cliente directo; el ranking por
        # cliente se calcula sobre pagos aplicados, que si tienen cliente_id.
        n = operacion.get("n") or 5
        where2 = "WHERE 1=1"
        params2: dict = {}
        if periodo:
            where2 += " AND p.fecha_pago BETWEEN :desde AND :hasta"
            params2.update(desde=periodo["desde"], hasta=periodo["hasta"])
        rows = db.execute(text(
            f"SELECT c.razon_social, SUM(p.monto) AS total, COUNT(*) AS cantidad FROM public.pagos_b2b p "
            f"JOIN public.clientes_b2b c ON c.id = p.cliente_id {where2} "
            f"GROUP BY c.razon_social ORDER BY total DESC LIMIT :n"
        ), {**params2, "n": n}).mappings().all()
        if not rows:
            return f"No hay pagos registrados en {etiqueta}.", {"periodo": etiqueta}
        lineas = [f"{i+1}. {r['razon_social']} — {_fmt_monto(r['total'])} ({r['cantidad']} pagos)" for i, r in enumerate(rows)]
        return (f"Top {len(rows)} clientes por monto pagado en {etiqueta}: " + "; ".join(lineas) + ".",
                {"top": [dict(r) for r in rows], "periodo": etiqueta})
    return None


def _resolver_casos(db: Session, tabla: str, etiqueta_tipo: str, periodo: dict | None, operacion: dict) -> tuple[str, dict] | None:
    where = "WHERE 1=1"
    params: dict = {}
    if periodo:
        where += " AND created_at::date BETWEEN :desde AND :hasta"
        params.update(desde=periodo["desde"], hasta=periodo["hasta"])
    etiqueta = periodo["etiqueta"] if periodo else "todo el historico"
    tipo = operacion["tipo"]

    if tipo == "contar":
        n = db.execute(text(f"SELECT COUNT(*) FROM public.{tabla} {where}"), params).scalar() or 0
        return f"Hubo {n} {etiqueta_tipo} en {etiqueta}.", {"cantidad": n, "periodo": etiqueta}
    if tipo == "sumar":
        s = db.execute(text(f"SELECT COALESCE(SUM(impacto_monto),0) FROM public.{tabla} {where}"), params).scalar() or 0
        return f"El impacto total de {etiqueta_tipo} en {etiqueta} es {_fmt_monto(s)}.", {"monto_total": float(s), "periodo": etiqueta}
    if tipo == "top":
        n = operacion.get("n") or 5
        rows = db.execute(text(
            f"SELECT c.razon_social, COUNT(*) AS cantidad FROM public.{tabla} x "
            f"JOIN public.clientes_b2b c ON c.id = x.cliente_id {where.replace('created_at', 'x.created_at')} "
            f"GROUP BY c.razon_social ORDER BY cantidad DESC LIMIT :n"
        ), {**params, "n": n}).mappings().all()
        if not rows:
            return f"No hay {etiqueta_tipo} en {etiqueta}.", {"periodo": etiqueta}
        lineas = [f"{i+1}. {r['razon_social']} — {r['cantidad']} casos" for i, r in enumerate(rows)]
        return (f"Top {len(rows)} clientes con mas {etiqueta_tipo} en {etiqueta}: " + "; ".join(lineas) + ".",
                {"top": [dict(r) for r in rows], "periodo": etiqueta})
    return None


def _resolver_gestiones(db: Session, periodo: dict | None, operacion: dict) -> tuple[str, dict] | None:
    where = "WHERE 1=1"
    params: dict = {}
    if periodo:
        where += " AND g.created_at::date BETWEEN :desde AND :hasta"
        params.update(desde=periodo["desde"], hasta=periodo["hasta"])
    etiqueta = periodo["etiqueta"] if periodo else "todo el historico"
    tipo = operacion["tipo"]

    if tipo == "contar":
        n = db.execute(text(f"SELECT COUNT(*) FROM public.gestiones_cobranza g {where}"), params).scalar() or 0
        return f"Hubo {n} gestiones de cobranza en {etiqueta}.", {"cantidad": n, "periodo": etiqueta}
    if tipo == "top":
        n = operacion.get("n") or 5
        rows = db.execute(text(
            f"SELECT c.razon_social, COUNT(*) AS cantidad FROM public.gestiones_cobranza g "
            f"JOIN public.clientes_b2b c ON c.id = g.cliente_id {where} "
            f"GROUP BY c.razon_social ORDER BY cantidad DESC LIMIT :n"
        ), {**params, "n": n}).mappings().all()
        if not rows:
            return f"No hay gestiones de cobranza en {etiqueta}.", {"periodo": etiqueta}
        lineas = [f"{i+1}. {r['razon_social']} — {r['cantidad']} gestiones" for i, r in enumerate(rows)]
        return (f"Top {len(rows)} clientes con mas gestiones de cobranza en {etiqueta}: " + "; ".join(lineas) + ".",
                {"top": [dict(r) for r in rows], "periodo": etiqueta})
    return None


def _resolver_cartera(db: Session, operacion: dict) -> tuple[str, dict] | None:
    tipo = operacion["tipo"]
    if tipo == "contar":
        n = db.execute(text("SELECT COUNT(*) FROM public.v_cartera_cobranza")).scalar() or 0
        return f"Hay {n} facturas en cartera pendiente actualmente.", {"cantidad": n}
    if tipo == "sumar":
        s = db.execute(text("SELECT COALESCE(SUM(saldo_pendiente),0) FROM public.v_cartera_cobranza")).scalar() or 0
        return f"La cartera pendiente actual es {_fmt_monto(s)}.", {"monto_total": float(s)}
    if tipo == "promediar":
        row = db.execute(text("SELECT COUNT(*), COALESCE(AVG(saldo_pendiente),0) FROM public.v_cartera_cobranza")).first()
        n, avg = row[0] or 0, row[1] or 0
        if n == 0:
            return "No hay facturas en cartera pendiente.", {"cantidad": 0}
        return f"El saldo pendiente promedio por factura en cartera es {_fmt_monto(avg)} (sobre {n} facturas).", {"promedio": float(avg), "cantidad": n}
    if tipo == "top":
        n = operacion.get("n") or 5
        rows = db.execute(text(
            "SELECT c.razon_social, SUM(v.saldo_pendiente) AS total, MAX(v.dias_vencidos) AS dias_max FROM public.v_cartera_cobranza v "
            "JOIN public.clientes_b2b c ON c.id = v.cliente_id "
            "GROUP BY c.razon_social ORDER BY total DESC LIMIT :n"
        ), {"n": n}).mappings().all()
        if not rows:
            return "No hay cartera pendiente registrada.", {}
        lineas = [f"{i+1}. {r['razon_social']} — {_fmt_monto(r['total'])} ({int(r['dias_max'])} dias vencido)" for i, r in enumerate(rows)]
        return ("Top " + str(len(rows)) + " clientes por saldo pendiente: " + "; ".join(lineas) + ".",
                {"top": [dict(r) for r in rows]})
    return None


def _resolver_riesgo(db: Session, operacion: dict) -> tuple[str, dict] | None:
    tipo = operacion["tipo"]
    if tipo == "contar":
        rows = db.execute(text("""
            SELECT r.nivel_riesgo, COUNT(*) FROM public.v_ml_riesgo_actual r
            WHERE EXISTS (SELECT 1 FROM public.facturas_b2b f WHERE f.cliente_id = r.cliente_id)
            GROUP BY r.nivel_riesgo
        """)).all()
        dist = {"BAJO": 0, "MEDIO": 0, "ALTO": 0}
        for nivel, cnt in rows:
            dist[nivel] = cnt
        return (f"Clientes evaluados por riesgo: {dist['ALTO']} en riesgo alto, {dist['MEDIO']} medio, {dist['BAJO']} bajo.",
                {"distribucion": dist})
    if tipo == "top":
        n = operacion.get("n") or 5
        rows = db.execute(text("""
            WITH saldo AS (
              SELECT cliente_id, SUM(saldo_pendiente) AS saldo_total, MAX(dias_vencidos) AS dias_max
              FROM public.v_cartera_cobranza GROUP BY cliente_id
            )
            SELECT c.razon_social, r.nivel_riesgo, r.probabilidad_pago,
                   COALESCE(s.saldo_total,0) AS saldo_pendiente, COALESCE(s.dias_max,0) AS dias_vencidos
            FROM public.v_ml_riesgo_actual r
            JOIN public.clientes_b2b c ON c.id = r.cliente_id
            LEFT JOIN saldo s ON s.cliente_id = r.cliente_id
            WHERE EXISTS (SELECT 1 FROM public.facturas_b2b f WHERE f.cliente_id = r.cliente_id)
            ORDER BY CASE r.nivel_riesgo WHEN 'ALTO' THEN 0 WHEN 'MEDIO' THEN 1 ELSE 2 END, saldo_pendiente DESC
            LIMIT :n
        """), {"n": n}).mappings().all()
        if not rows:
            return "Aun no hay predicciones de riesgo calculadas.", {}
        lineas = [f"{i+1}. {r['razon_social']} — riesgo {r['nivel_riesgo']}, {_fmt_monto(r['saldo_pendiente'])} pendientes, {int(r['dias_vencidos'])} dias vencido" for i, r in enumerate(rows)]
        return (f"Top {len(rows)} clientes mas criticos: " + "; ".join(lineas) + ".", {"top": [dict(r) for r in rows]})
    return None


def _resolver_comunicaciones(db: Session, periodo: dict | None, operacion: dict) -> tuple[str, dict] | None:
    where = "WHERE 1=1"
    params: dict = {}
    if periodo:
        where += " AND e.recibido_at::date BETWEEN :desde AND :hasta"
        params.update(desde=periodo["desde"], hasta=periodo["hasta"])
    etiqueta = periodo["etiqueta"] if periodo else "todo el historico"
    tipo = operacion["tipo"]

    if tipo == "contar":
        n = db.execute(text(f"SELECT COUNT(*) FROM public.emails_cobranza e {where}"), params).scalar() or 0
        return f"Hubo {n} correos de cobranza en {etiqueta}.", {"cantidad": n, "periodo": etiqueta}
    if tipo == "top":
        rows = db.execute(text(
            f"SELECT COALESCE(e.clasificacion, 'SIN_CLASIFICAR') AS clasificacion, COUNT(*) AS cantidad FROM public.emails_cobranza e "
            f"{where} GROUP BY clasificacion ORDER BY cantidad DESC LIMIT 5"
        ), params).mappings().all()
        if not rows:
            return f"No hay correos registrados en {etiqueta}.", {"periodo": etiqueta}
        lineas = [f"{r['clasificacion']}: {r['cantidad']}" for r in rows]
        return (f"Correos por clasificacion en {etiqueta}: " + "; ".join(lineas) + ".", {"top": [dict(r) for r in rows], "periodo": etiqueta})
    return None


def resolver_consulta_generica(db: Session, pregunta: str) -> tuple[str, dict] | None:
    """Punto de entrada: intenta resolver la pregunta con calculo real sobre
    Supabase. Devuelve None si la pregunta no trae una operacion reconocible
    (conteo/suma/promedio/top/maximo/minimo), para que el llamador siga con
    el catalogo fijo de categorias."""
    operacion = detectar_operacion(pregunta)
    if operacion is None:
        return None
    dataset = detectar_dataset(pregunta)
    if dataset is None and operacion["tipo"] == "top":
        dataset = "riesgo"  # "top 10 clientes mas criticos" sin mas pistas
    if dataset is None:
        return None
    periodo = parsear_periodo(pregunta)

    if dataset == "facturas":
        return _resolver_facturas(db, periodo, operacion)
    if dataset == "movimientos":
        return _resolver_movimientos(db, periodo, operacion)
    if dataset == "casos_facturacion":
        return _resolver_casos(db, "casos_facturacion", "casos de facturacion", periodo, operacion)
    if dataset == "casos_cobranza":
        return _resolver_casos(db, "casos_cobranza", "casos de cobranza", periodo, operacion)
    if dataset == "gestiones_cobranza":
        return _resolver_gestiones(db, periodo, operacion)
    if dataset == "cartera":
        return _resolver_cartera(db, operacion)
    if dataset == "riesgo":
        return _resolver_riesgo(db, operacion)
    if dataset == "comunicaciones":
        return _resolver_comunicaciones(db, periodo, operacion)
    return None
