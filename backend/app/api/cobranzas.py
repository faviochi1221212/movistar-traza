from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.serialization import model_to_dict, to_jsonable
from app.models.models import CasoCobranza, ClienteB2B, EmailCobranza, FacturaB2B, GestionCobranza
from app.services import cobranzas

router = APIRouter(prefix="/api/cobranzas", tags=["cobranzas"])


@router.get("/resumen")
def resumen(db: Session = Depends(get_db)):
    return cobranzas.resumen_cartera(db)


@router.get("/cartera")
def cartera(aging: str | None = None, limit: int = 100, offset: int = 0, db: Session = Depends(get_db)):
    rows = cobranzas.obtener_cartera(db, estado=aging, limit=limit, offset=offset)
    return [to_jsonable(dict(r)) for r in rows]


@router.get("/emails")
def emails(clasificacion: str | None = None, limit: int = 50, db: Session = Depends(get_db)):
    q = db.query(EmailCobranza)
    if clasificacion and clasificacion != "TODOS":
        q = q.filter(EmailCobranza.clasificacion == clasificacion)
    rows = q.order_by(EmailCobranza.recibido_at.desc()).limit(limit).all()
    out = []
    for e in rows:
        d = model_to_dict(e)
        d["cliente_nombre"] = e.cliente.razon_social if e.cliente else None
        out.append(d)
    return out


@router.get("/emails/{email_id}")
def email_detalle(email_id: str, db: Session = Depends(get_db)):
    email = db.query(EmailCobranza).get(email_id)
    if not email:
        raise HTTPException(404, "Correo no encontrado")
    d = model_to_dict(email)
    d["cliente_nombre"] = email.cliente.razon_social if email.cliente else None
    return d


@router.post("/emails/{email_id}/clasificar")
def clasificar(email_id: str, db: Session = Depends(get_db)):
    email = db.query(EmailCobranza).get(email_id)
    if not email:
        raise HTTPException(404, "Correo no encontrado")
    cobranzas.clasificar_email(db, email)
    db.commit()
    return model_to_dict(email)


class CorregirBody(BaseModel):
    clasificacion: str
    usuario: str | None = None


@router.post("/emails/{email_id}/corregir")
def corregir(email_id: str, body: CorregirBody, db: Session = Depends(get_db)):
    email = db.query(EmailCobranza).get(email_id)
    if not email:
        raise HTTPException(404, "Correo no encontrado")
    cobranzas.corregir_clasificacion(db, email, body.clasificacion, body.usuario)
    db.commit()
    return model_to_dict(email)


@router.get("/casos")
def casos(estado: str | None = None, db: Session = Depends(get_db)):
    q = db.query(CasoCobranza)
    if estado and estado != "TODOS":
        q = q.filter(CasoCobranza.estado == estado)
    else:
        q = q.filter(CasoCobranza.estado.in_(["ABIERTO", "EN_REVISION"]))
    rows = q.order_by(CasoCobranza.prioridad.desc(), CasoCobranza.created_at.desc()).limit(100).all()
    out = []
    for c in rows:
        d = model_to_dict(c)
        d["cliente_nombre"] = c.cliente.razon_social if c.cliente else None
        out.append(d)
    return out


@router.get("/gestion/{factura_id}")
def gestion_detalle(factura_id: str, db: Session = Depends(get_db)):
    factura = db.query(FacturaB2B).get(factura_id)
    if not factura:
        raise HTTPException(404, "Factura no encontrada")
    gestion = db.query(GestionCobranza).filter(GestionCobranza.factura_id == factura_id).first()
    ultimo_email = (
        db.query(EmailCobranza)
        .filter(EmailCobranza.factura_id == factura_id)
        .order_by(EmailCobranza.recibido_at.desc())
        .first()
    )
    return {
        "factura": model_to_dict(factura),
        "cliente": model_to_dict(factura.cliente) if factura.cliente else None,
        "gestion": model_to_dict(gestion) if gestion else None,
        "ultimo_email": model_to_dict(ultimo_email) if ultimo_email else None,
    }


class GestionBody(BaseModel):
    notas: str | None = None
    prioridad: str | None = None


@router.post("/gestiones/{factura_id}")
def crear_gestion(factura_id: str, body: GestionBody, db: Session = Depends(get_db)):
    factura = db.query(FacturaB2B).get(factura_id)
    if not factura:
        raise HTTPException(404, "Factura no encontrada")
    gestion = cobranzas.registrar_gestion(db, factura, notas=body.notas, prioridad=body.prioridad)
    db.commit()
    return model_to_dict(gestion)


class PromesaBody(BaseModel):
    monto: float
    fecha_prometida: date
    origen: str = "MANUAL"


@router.post("/promesas/{factura_id}")
def crear_promesa(factura_id: str, body: PromesaBody, db: Session = Depends(get_db)):
    factura = db.query(FacturaB2B).get(factura_id)
    if not factura:
        raise HTTPException(404, "Factura no encontrada")
    promesa = cobranzas.registrar_promesa_pago(db, factura, body.monto, body.fecha_prometida, body.origen)
    db.commit()
    return model_to_dict(promesa)


@router.post("/procesar-lote")
def procesar_lote(db: Session = Depends(get_db)):
    pendientes = db.query(EmailCobranza).filter(EmailCobranza.procesado.is_(False)).limit(50).all()
    clasificados = 0
    for email in pendientes:
        cobranzas.clasificar_email(db, email)
        if email.procesado:
            clasificados += 1
    incumplidas = cobranzas.detectar_promesas_incumplidas(db)
    db.commit()
    return {"emails_clasificados": clasificados, "emails_totales": len(pendientes), "promesas_incumplidas": incumplidas}
