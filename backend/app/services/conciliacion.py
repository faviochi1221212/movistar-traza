"""Recaudo: matching bancario deterministico, conciliacion, aplicacion de pago y rebaja.

Nunca se usa un LLM para decidir una conciliacion (seccion 15). El score es
deterministico y explicable:
  Referencia/factura exacta   40%
  Monto compatible            30%
  Cliente/RUC compatible      20%
  Fecha compatible            10%
"""
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core import orchestrator
from app.models.models import (
    AplicacionPago, Conciliacion, FacturaB2B, MatchBancario,
    MovimientoBancarioDemo, PagoB2B, RebajaDocumento,
)
from app.services import audit
from app.services.rules import get_regla


def _facturas_con_saldo(db: Session, cliente_id=None):
    sql = (
        "SELECT v.factura_id, v.cliente_id, v.numero, v.saldo_pendiente, v.fecha_vencimiento, "
        "c.numero_identificacion_fiscal, c.razon_social "
        "FROM public.v_facturas_saldo v "
        "JOIN public.clientes_b2b c ON c.id = v.cliente_id "
        "WHERE v.saldo_pendiente > 0"
    )
    params = {}
    if cliente_id:
        sql += " AND v.cliente_id = :cliente_id"
        params["cliente_id"] = str(cliente_id)
    return db.execute(text(sql), params).mappings().all()


def calcular_score(movimiento: MovimientoBancarioDemo, factura_row) -> tuple[float, dict]:
    criterios = {}
    score = 0.0

    referencia = (movimiento.nro_operacion or "") + " " + (movimiento.descripcion or "")
    referencia = referencia.upper()
    ref_ok = bool(factura_row["numero"]) and factura_row["numero"].upper() in referencia
    criterios["referencia_factura"] = ref_ok
    if ref_ok:
        score += 0.40

    saldo = Decimal(str(factura_row["saldo_pendiente"]))
    monto = Decimal(str(movimiento.monto))
    diff_pct = abs(monto - saldo) / saldo if saldo else Decimal("1")
    monto_ok = diff_pct <= Decimal("0.01")
    monto_cercano = diff_pct <= Decimal("0.05")
    criterios["monto_compatible"] = monto_ok or monto_cercano
    if monto_ok:
        score += 0.30
    elif monto_cercano:
        score += 0.15

    pistas = [factura_row["numero_identificacion_fiscal"] or "", factura_row["razon_social"] or ""]
    cliente_ok = any(p and p.upper() in referencia for p in pistas)
    criterios["cliente_compatible"] = cliente_ok
    if cliente_ok:
        score += 0.20

    fecha_ok = False
    venc = factura_row["fecha_vencimiento"]
    if venc:
        delta = abs((movimiento.fecha_movimiento.date() - venc).days)
        fecha_ok = delta <= 15
    criterios["fecha_compatible"] = fecha_ok
    if fecha_ok:
        score += 0.10

    return round(score, 4), criterios


def tipo_match_de_score(db: Session, score: float) -> str:
    auto_min = float(get_regla(db, "MATCH_AUTOMATICO_SCORE_MIN") or 0.95)
    manual_min = float(get_regla(db, "MATCH_REVISION_MANUAL_SCORE_MIN") or 0.70)
    if score >= auto_min:
        return "EXACTO"
    if score >= manual_min:
        return "PARCIAL"
    return "SIN_MATCH"


def buscar_candidatos(db: Session, movimiento: MovimientoBancarioDemo, top: int = 5):
    filas = _facturas_con_saldo(db)
    resultados = []
    for row in filas:
        score, criterios = calcular_score(movimiento, row)
        if score <= 0:
            continue
        resultados.append({"factura_id": row["factura_id"], "cliente_id": row["cliente_id"], "score": score, "criterios": criterios})
    resultados.sort(key=lambda r: r["score"], reverse=True)
    return resultados[:top]


def evaluar_match(db: Session, movimiento: MovimientoBancarioDemo) -> MatchBancario:
    candidatos = buscar_candidatos(db, movimiento)
    existente = db.query(MatchBancario).filter(MatchBancario.movimiento_id == movimiento.id, MatchBancario.estado == "SUGERIDO").first()

    if not candidatos:
        tipo_match = "SIN_MATCH"
        best = {"factura_id": None, "cliente_id": None, "score": 0.0, "criterios": {}}
        requiere_manual = True
    else:
        best = candidatos[0]
        tipo_match = tipo_match_de_score(db, best["score"])
        ambiguo = len(candidatos) > 1 and (best["score"] - candidatos[1]["score"]) < 0.05
        requiere_manual = tipo_match != "EXACTO" or ambiguo
        best["criterios"]["candidatos_alternativos"] = [
            {"factura_id": str(c["factura_id"]), "score": c["score"]} for c in candidatos[1:4]
        ]

    if existente:
        existente.score = best["score"]
        existente.tipo_match = tipo_match
        existente.cliente_id = best["cliente_id"]
        existente.factura_id = best["factura_id"]
        existente.criterios = best["criterios"]
        existente.requiere_revision_manual = requiere_manual
        match = existente
    else:
        match = MatchBancario(
            movimiento_id=movimiento.id, cliente_id=best["cliente_id"], factura_id=best["factura_id"],
            score=best["score"], tipo_match=tipo_match, criterios=best["criterios"],
            requiere_revision_manual=requiere_manual, estado="SUGERIDO",
        )
        db.add(match)
    movimiento.estado = "IDENTIFICADO" if best["factura_id"] else movimiento.estado
    db.flush()

    audit.log(db, actor_tipo="AGENT", actor_id="COBRANZAS", accion="EVALUAR_MATCH_BANCARIO",
               entidad_tipo="matches_bancarios", entidad_id=match.id,
               after_data={"tipo_match": tipo_match, "score": best["score"]})
    return match


def _pago_para_movimiento(db: Session, movimiento: MovimientoBancarioDemo, cliente_id, factura_id) -> PagoB2B:
    pago = PagoB2B(
        cliente_id=cliente_id, factura_id=factura_id, fecha_pago=movimiento.fecha_movimiento.date(),
        monto=movimiento.monto, medio=movimiento.banco, referencia_operacion=movimiento.nro_operacion,
        identificado=True, fuente="BANCO",
    )
    db.add(pago)
    db.flush()
    return pago


def aplicar_pago_factura(db: Session, pago: PagoB2B, factura: FacturaB2B, monto: Decimal, conciliacion_id=None, trace_id=None) -> AplicacionPago:
    aplicacion = AplicacionPago(pago_id=pago.id, factura_id=factura.id, conciliacion_id=conciliacion_id, monto_aplicado=monto)
    db.add(aplicacion)
    db.flush()
    audit.log(db, actor_tipo="SYSTEM", accion="APLICAR_PAGO_FACTURA", entidad_tipo="aplicaciones_pago",
               entidad_id=aplicacion.id, after_data={"pago_id": str(pago.id), "factura_id": str(factura.id), "monto": float(monto)},
               trace_id=trace_id)
    return aplicacion


def generar_rebaja(db: Session, factura: FacturaB2B, pago: PagoB2B, aplicacion: AplicacionPago, trace_id=None) -> RebajaDocumento:
    ya_existe = db.query(RebajaDocumento).filter(RebajaDocumento.aplicacion_pago_id == aplicacion.id).first()
    if ya_existe:
        return ya_existe
    rebaja = RebajaDocumento(
        factura_id=factura.id, pago_id=pago.id, aplicacion_pago_id=aplicacion.id,
        monto_rebajado=aplicacion.monto_aplicado, estado="PROCESADA", procesada_at=datetime.now(timezone.utc),
    )
    db.add(rebaja)
    db.flush()
    audit.log(db, actor_tipo="SYSTEM", accion="GENERAR_REBAJA", entidad_tipo="rebajas_documento", entidad_id=rebaja.id, trace_id=trace_id)
    return rebaja


def conciliar_match(db: Session, match: MatchBancario, *, metodo: str, usuario_id=None) -> Conciliacion:
    if match.factura_id is None:
        raise ValueError("El match no tiene una factura candidata; no se puede conciliar.")
    ya_conciliado = db.query(Conciliacion).filter(Conciliacion.movimiento_id == match.movimiento_id, Conciliacion.estado == "CONCILIADO").first()
    if ya_conciliado:
        raise ValueError("Este movimiento ya fue conciliado.")

    movimiento = db.query(MovimientoBancarioDemo).get(match.movimiento_id)
    factura = db.query(FacturaB2B).get(match.factura_id)
    pago = _pago_para_movimiento(db, movimiento, match.cliente_id, match.factura_id)

    traza = orchestrator.get_or_create_traza(db, match.cliente_id, match.factura_id)

    conciliacion = Conciliacion(
        movimiento_id=movimiento.id, pago_id=pago.id, factura_id=factura.id, match_id=match.id,
        monto_conciliado=movimiento.monto, metodo=metodo, estado="CONCILIADO",
        revisado_por=usuario_id, conciliado_at=datetime.now(timezone.utc),
    )
    db.add(conciliacion)
    db.flush()

    aplicacion = aplicar_pago_factura(db, pago, factura, movimiento.monto, conciliacion_id=conciliacion.id, trace_id=traza.id)
    generar_rebaja(db, factura, pago, aplicacion, trace_id=traza.id)

    movimiento.estado = "CONCILIADO"
    match.estado = "ACEPTADO"
    db.flush()

    audit.log(db, actor_tipo="USER" if metodo == "MANUAL" else "SYSTEM", actor_id=str(usuario_id) if usuario_id else None,
               accion="CONCILIAR_PAGO", entidad_tipo="conciliaciones", entidad_id=conciliacion.id, trace_id=traza.id)
    return conciliacion


def rechazar_match(db: Session, match: MatchBancario, motivo: str) -> MatchBancario:
    match.estado = "RECHAZADO"
    db.flush()
    audit.log(db, actor_tipo="USER", accion="RECHAZAR_MATCH_BANCARIO", entidad_tipo="matches_bancarios",
               entidad_id=match.id, after_data={"motivo": motivo})
    return match


def conciliar_automaticos_pendientes(db: Session) -> int:
    """Corre sobre movimientos PENDIENTE/IDENTIFICADO: evalua match y concilia
    automaticamente solo si el candidato es EXACTO e inequivoco."""
    pendientes = db.query(MovimientoBancarioDemo).filter(MovimientoBancarioDemo.estado.in_(["PENDIENTE", "IDENTIFICADO"])).all()
    conciliados = 0
    for mov in pendientes:
        match = evaluar_match(db, mov)
        if match.tipo_match == "EXACTO" and not match.requiere_revision_manual:
            try:
                conciliar_match(db, match, metodo="AUTOMATICO")
                conciliados += 1
            except ValueError:
                continue
    return conciliados
