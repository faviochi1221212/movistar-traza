from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.serialization import model_to_dict
from app.services import rules

router = APIRouter(prefix="/api/configuracion", tags=["configuracion"])


@router.get("/reglas")
def reglas(modulo: str | None = None, db: Session = Depends(get_db)):
    return [model_to_dict(r) for r in rules.get_reglas_modulo(db, modulo)]


class ReglaBody(BaseModel):
    valor: float | str | bool
    usuario: str | None = None


@router.put("/reglas/{codigo}")
def actualizar_regla(codigo: str, body: ReglaBody, db: Session = Depends(get_db)):
    try:
        regla = rules.update_regla(db, codigo, body.valor, usuario_id=None)
    except ValueError as exc:
        raise HTTPException(404, str(exc))
    db.commit()
    return model_to_dict(regla)
