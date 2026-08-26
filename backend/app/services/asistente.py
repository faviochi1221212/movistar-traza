"""Preguntar a TRAZA: catalogo fijo de funciones + Dify solo para explicar en
lenguaje natural. No se permite SQL libre generado por el LLM (seccion 27)."""
import re

from sqlalchemy.orm import Session

from app.integrations.dify import get_dify_assistant
from app.models.models import ClienteB2B
from app.services import auditoria, bi, cobranzas, facturacion

FUERA_DE_ALCANCE = (
    "TRAZA esta enfocado en Facturacion, Cobranzas, Recaudo y BI del ciclo de ingreso B2B. "
    "No tengo informacion para responder esa pregunta."
)


def _consultar_facturacion(db: Session) -> tuple[str, dict]:
    r = facturacion.resumen_ciclo(db)
    ctx = (f"Validaciones correctas: {r['validacion']['correctas']}, en revision: {r['validacion']['en_revision']}. "
           f"Conformidades pendientes: {r['conformidad']['pendientes']}. "
           f"Facturas emitidas: {r['emision']['emitidas']} por S/ {r['emision']['monto_emitido']:.2f}. "
           f"Casos abiertos: {r['control']['casos_abiertos']} ({r['control']['casos_criticos']} criticos).")
    return ctx, r


def _consultar_cartera(db: Session) -> tuple[str, dict]:
    r = cobranzas.resumen_cartera(db)
    ctx = (f"Cartera pendiente: S/ {r['cartera_pendiente']:.2f}. Cartera vencida: S/ {r['cartera_vencida']:.2f}. "
           f"Ratio cobrado/facturado: {r['ratio_cobrado_facturado']*100:.1f}%. "
           f"Clientes en riesgo alto: {r['clientes_riesgo_alto']}.")
    return ctx, r


def _consultar_cliente(db: Session, texto: str) -> tuple[str, dict]:
    cliente = (
        db.query(ClienteB2B)
        .filter(ClienteB2B.razon_social.ilike(f"%{texto}%") | ClienteB2B.numero_identificacion_fiscal.ilike(f"%{texto}%"))
        .first()
    )
    if not cliente:
        return "No se encontro un cliente que coincida con esa referencia.", {}
    from sqlalchemy import text as sqltext
    row = db.execute(sqltext("SELECT * FROM public.v_cliente_360 WHERE cliente_id = :id"), {"id": str(cliente.id)}).mappings().first()
    ctx = (f"Cliente {cliente.razon_social}: {row['total_facturas']} facturas, saldo pendiente S/ {row['saldo_pendiente']:.2f}, "
           f"{row['casos_facturacion_abiertos']} casos de facturacion abiertos, {row['casos_cobranza_abiertos']} de cobranza. "
           f"Riesgo: {row['nivel_riesgo'] or 'sin evaluar'}.")
    return ctx, dict(row) if row else {}


def _consultar_conciliacion(db: Session) -> tuple[str, dict]:
    r = bi.resumen_general(db)["recaudo"]
    ctx = (f"Conciliaciones automaticas: {r['conciliaciones_automaticas']}, manuales: {r['conciliaciones_manuales']}. "
           f"Movimientos bancarios pendientes: {r['movimientos_pendientes']}. Monto aplicado: S/ {r['monto_pagado_aplicado']:.2f}.")
    return ctx, r


def _consultar_riesgo(db: Session) -> tuple[str, dict]:
    top = bi.top_riesgo(db, limit=5)
    if not top:
        return "Aun no hay predicciones de riesgo calculadas.", {}
    lineas = [f"{t['razon_social']}: {t['probabilidad_pago']*100:.1f}% probabilidad de pago, saldo S/ {t['saldo_pendiente']:.2f}" for t in top]
    ctx = "Clientes con mayor riesgo de impago: " + "; ".join(lineas)
    return ctx, {"top": [dict(t) for t in top]}


def _consultar_auditoria(db: Session) -> tuple[str, dict]:
    r = auditoria.resumen(db)
    ctx = (f"Eventos registrados: {r['eventos_registrados']}. Acciones de IA: {r['acciones_ia_ejecutadas']}. "
           f"Revisiones pendientes: {r['revisiones_pendientes']}. Alertas criticas: {r['alertas_criticas']}.")
    return ctx, r


def _consultar_recupero(db: Session) -> tuple[str, dict]:
    ops = bi.oportunidades_recupero(db, limit=5)
    if not ops:
        return "No se identificaron oportunidades de recupero por ahora.", {}
    lineas = [f"{o['razon_social']} ({o['oportunidad']}, S/ {float(o['saldo_pendiente']):.2f})" for o in ops]
    ctx = "Principales oportunidades de recupero: " + "; ".join(lineas)
    return ctx, {"oportunidades": [dict(o) for o in ops]}


# CLIENT_00081 es el formato real de los datos cargados (razon_social viene
# directo de nombre_cliente en el CSV). CLIENTE_DEMO_007 era el formato
# ficticio del mockup original -- se mantiene por compatibilidad, pero ya
# no existe ningun cliente real con ese nombre.
CLIENTE_ID_PATTERN = r"CLIENTE[_ ]?DEMO[_ ]?\d+|CLIENT[_ ]?\d+|\bruc\b|[0-9]{8,11}"

# "cliente"/"clientes" aparece como palabra suelta en casi cualquier pregunta
# agregada ("que CLIENTES tienen mayor riesgo?"), asi que esa categoria va al
# final y solo dispara si hay un identificador real de cliente (RUC o
# CLIENTE_DEMO_x) en el texto -- nunca por la palabra generica sola.
_RULES = [
    (re.compile(r"cartera|vencid|cobrad|ratio|mora", re.I), "cartera"),
    (re.compile(r"riesgo|predic", re.I), "riesgo"),
    (re.compile(r"conciliaci|movimiento banc|manual", re.I), "conciliacion"),
    (re.compile(r"recuper|oportunidad", re.I), "recupero"),
    (re.compile(r"auditor|decisi[oó]n|traza", re.I), "auditoria"),
    (re.compile(r"factura|conformidad|emisi[oó]n|validaci", re.I), "facturacion"),
    (re.compile(CLIENTE_ID_PATTERN, re.I), "cliente"),
]


def _clasificar_pregunta(pregunta: str) -> str | None:
    for pattern, categoria in _RULES:
        if pattern.search(pregunta):
            return categoria
    return None


def responder(db: Session, pregunta: str) -> dict:
    categoria = _clasificar_pregunta(pregunta)
    if categoria is None:
        return {"respuesta": FUERA_DE_ALCANCE, "categoria": None, "datos": {}}

    if categoria == "cliente":
        match = re.search(CLIENTE_ID_PATTERN, pregunta, re.I)
        texto = match.group(0) if match else pregunta
        contexto, datos = _consultar_cliente(db, texto)
    else:
        handler = {
            "cartera": _consultar_cartera, "riesgo": _consultar_riesgo,
            "conciliacion": _consultar_conciliacion, "recupero": _consultar_recupero,
            "auditoria": _consultar_auditoria, "facturacion": _consultar_facturacion,
        }[categoria]
        contexto, datos = handler(db)

    respuesta_natural = get_dify_assistant().preguntar(pregunta, contexto)
    respuesta_final = respuesta_natural or contexto  # fallback local si Dify no esta configurado
    return {"respuesta": respuesta_final, "categoria": categoria, "datos": datos}
