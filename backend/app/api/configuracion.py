from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.serialization import model_to_dict
from app.services import audit, rules

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


class SupervisorAccesoBody(BaseModel):
    usuario: str


@router.post("/supervisor-acceso")
def registrar_acceso_supervisor(body: SupervisorAccesoBody, db: Session = Depends(get_db)):
    """No existe un sistema de autenticacion/roles propio en TRAZA todavia: este
    endpoint no valida contrasena ni emite sesion, solo dexja constancia real en
    Auditoria de que alguien reautentico para entrar al modo supervisor (seccion
    30 del prompt de gobierno de agentes)."""
    entry = audit.log(
        db, actor_tipo="USER", actor_id=body.usuario, accion="ACCESO_SUPERVISOR",
        entidad_tipo="configuracion", metadata={"vista": "gobierno_agentes"},
    )
    db.commit()
    return {"ok": True, "timestamp": model_to_dict(entry).get("created_at")}
