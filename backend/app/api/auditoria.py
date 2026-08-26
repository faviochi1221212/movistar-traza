import csv
import io

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.serialization import model_to_dict
from app.services import auditoria

router = APIRouter(prefix="/api/auditoria", tags=["auditoria"])


@router.get("/resumen")
def resumen(db: Session = Depends(get_db)):
    return auditoria.resumen(db)


@router.get("")
def listar(limit: int = 100, offset: int = 0, entidad_tipo: str | None = None, db: Session = Depends(get_db)):
    return [model_to_dict(e) for e in auditoria.listar_eventos(db, limit=limit, offset=offset, entidad_tipo=entidad_tipo)]


@router.get("/export")
def exportar(db: Session = Depends(get_db)):
    rows = auditoria.listar_eventos(db, limit=2000, offset=0)
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["fecha", "actor_tipo", "actor_id", "accion", "entidad_tipo", "entidad_id"])
    for e in rows:
        writer.writerow([e.created_at.isoformat(), e.actor_tipo, e.actor_id, e.accion, e.entidad_tipo, e.entidad_id])
    buf.seek(0)
    return StreamingResponse(buf, media_type="text/csv", headers={"Content-Disposition": "attachment; filename=audit_log.csv"})


@router.get("/{trace_id}")
def traza(trace_id: str, db: Session = Depends(get_db)):
    data = auditoria.reconstruir_traza(db, trace_id)
    if not data:
        raise HTTPException(404, "Traza no encontrada")
    return data
