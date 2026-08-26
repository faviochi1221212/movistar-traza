import csv
import io

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.serialization import model_to_dict
from app.models.models import Conciliacion, FacturaB2B, MatchBancario, MovimientoBancarioDemo, PagoB2B
from app.services import conciliacion

router = APIRouter(prefix="/api/recaudo", tags=["recaudo"])


@router.get("/resumen")
def resumen(db: Session = Depends(get_db)):
    total = db.query(MovimientoBancarioDemo).count()
    pendientes = db.query(MovimientoBancarioDemo).filter(MovimientoBancarioDemo.estado.in_(["PENDIENTE", "IDENTIFICADO"])).count()
    conciliados = db.query(MovimientoBancarioDemo).filter(MovimientoBancarioDemo.estado == "CONCILIADO").count()
    monto_recibido = db.query(MovimientoBancarioDemo.monto).all()
    total_monto = float(sum(m[0] for m in monto_recibido)) if monto_recibido else 0.0
    return {"total_movimientos": total, "pendientes": pendientes, "conciliados": conciliados, "monto_recibido": total_monto}


@router.get("/movimientos")
def movimientos(estado: str | None = None, limit: int = 100, db: Session = Depends(get_db)):
    q = db.query(MovimientoBancarioDemo)
    if estado and estado != "TODOS":
        q = q.filter(MovimientoBancarioDemo.estado == estado)
    rows = q.order_by(MovimientoBancarioDemo.fecha_movimiento.desc()).limit(limit).all()
    out = []
    for m in rows:
        d = model_to_dict(m)
        match = db.query(MatchBancario).filter(MatchBancario.movimiento_id == m.id).order_by(MatchBancario.created_at.desc()).first()
        if match:
            d["match"] = model_to_dict(match)
            d["cliente_sugerido"] = match.cliente.razon_social if match.cliente else None
            d["factura_sugerida"] = match.factura.numero if match.factura else None
        out.append(d)
    return out


@router.get("/movimientos/{movimiento_id}")
def movimiento_detalle(movimiento_id: str, db: Session = Depends(get_db)):
    mov = db.query(MovimientoBancarioDemo).get(movimiento_id)
    if not mov:
        raise HTTPException(404, "Movimiento no encontrado")
    match = db.query(MatchBancario).filter(MatchBancario.movimiento_id == mov.id).order_by(MatchBancario.created_at.desc()).first()
    candidatos = conciliacion.buscar_candidatos(db, mov) if not match or match.estado != "ACEPTADO" else []
    candidatos_detalle = []
    for c in candidatos:
        factura = db.query(FacturaB2B).get(c["factura_id"])
        candidatos_detalle.append({**c, "factura_numero": factura.numero if factura else None,
                                     "cliente_nombre": factura.cliente.razon_social if factura and factura.cliente else None})
    return {
        "movimiento": model_to_dict(mov),
        "match": model_to_dict(match) if match else None,
        "candidatos": candidatos_detalle,
    }


@router.post("/movimientos/{movimiento_id}/evaluar")
def evaluar(movimiento_id: str, db: Session = Depends(get_db)):
    mov = db.query(MovimientoBancarioDemo).get(movimiento_id)
    if not mov:
        raise HTTPException(404, "Movimiento no encontrado")
    match = conciliacion.evaluar_match(db, mov)
    db.commit()
    return model_to_dict(match)


class ConfirmarBody(BaseModel):
    factura_id: str | None = None  # permite elegir un candidato distinto al sugerido


@router.post("/matches/{match_id}/confirmar")
def confirmar(match_id: str, body: ConfirmarBody, db: Session = Depends(get_db)):
    match = db.query(MatchBancario).get(match_id)
    if not match:
        raise HTTPException(404, "Match no encontrado")
    if body.factura_id:
        match.factura_id = body.factura_id
        factura = db.query(FacturaB2B).get(body.factura_id)
        match.cliente_id = factura.cliente_id if factura else match.cliente_id
    try:
        conciliacion.conciliar_match(db, match, metodo="MANUAL")
    except ValueError as exc:
        raise HTTPException(409, str(exc))
    db.commit()
    return model_to_dict(match)


class RechazarBody(BaseModel):
    motivo: str


@router.post("/matches/{match_id}/rechazar")
def rechazar(match_id: str, body: RechazarBody, db: Session = Depends(get_db)):
    match = db.query(MatchBancario).get(match_id)
    if not match:
        raise HTTPException(404, "Match no encontrado")
    conciliacion.rechazar_match(db, match, body.motivo)
    db.commit()
    return model_to_dict(match)


@router.post("/procesar-lote")
def procesar_lote(db: Session = Depends(get_db)):
    conciliados = conciliacion.conciliar_automaticos_pendientes(db)
    db.commit()
    return {"conciliados_automaticamente": conciliados}


@router.get("/export")
def exportar(db: Session = Depends(get_db)):
    rows = db.query(MovimientoBancarioDemo).order_by(MovimientoBancarioDemo.fecha_movimiento.desc()).limit(1000).all()
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["fecha", "banco", "operacion", "monto", "estado"])
    for m in rows:
        writer.writerow([m.fecha_movimiento.isoformat(), m.banco, m.nro_operacion, float(m.monto), m.estado])
    buf.seek(0)
    return StreamingResponse(buf, media_type="text/csv", headers={"Content-Disposition": "attachment; filename=movimientos_bancarios.csv"})
