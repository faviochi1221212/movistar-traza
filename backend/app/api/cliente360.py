from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.serialization import to_jsonable
from app.models.models import CasoCobranza, CasoFacturacion, ClienteB2B, EmailCobranza, FacturaB2B

router = APIRouter(prefix="/api/cliente360", tags=["cliente360"])


@router.get("/buscar")
def buscar(q: str, db: Session = Depends(get_db)):
    clientes = (
        db.query(ClienteB2B)
        .filter(ClienteB2B.razon_social.ilike(f"%{q}%") | ClienteB2B.numero_identificacion_fiscal.ilike(f"%{q}%"))
        .limit(20)
        .all()
    )
    return [{"id": str(c.id), "razon_social": c.razon_social, "ruc": c.numero_identificacion_fiscal} for c in clientes]


@router.get("/{cliente_id}")
def detalle(cliente_id: str, db: Session = Depends(get_db)):
    cliente = db.query(ClienteB2B).get(cliente_id)
    if not cliente:
        raise HTTPException(404, "Cliente no encontrado")
    resumen = db.execute(text("SELECT * FROM public.v_cliente_360 WHERE cliente_id = :id"), {"id": str(cliente_id)}).mappings().first()

    facturas = db.query(FacturaB2B).filter(FacturaB2B.cliente_id == cliente_id).order_by(FacturaB2B.fecha_emision.desc()).limit(20).all()
    casos_fact = db.query(CasoFacturacion).filter(CasoFacturacion.cliente_id == cliente_id, CasoFacturacion.estado.in_(["ABIERTO", "EN_REVISION"])).all()
    casos_cob = db.query(CasoCobranza).filter(CasoCobranza.cliente_id == cliente_id, CasoCobranza.estado.in_(["ABIERTO", "EN_REVISION"])).all()
    emails = db.query(EmailCobranza).filter(EmailCobranza.cliente_id == cliente_id).order_by(EmailCobranza.recibido_at.desc()).limit(10).all()

    dias_promedio_pago = db.execute(text("""
        SELECT AVG(p.fecha_pago - f.fecha_emision)
        FROM public.aplicaciones_pago ap
        JOIN public.pagos_b2b p ON p.id = ap.pago_id
        JOIN public.facturas_b2b f ON f.id = ap.factura_id
        WHERE f.cliente_id = :id
    """), {"id": str(cliente_id)}).scalar()

    from app.core.serialization import model_to_dict
    return to_jsonable({
        "cliente": model_to_dict(cliente),
        "resumen": dict(resumen) if resumen else None,
        "dias_promedio_pago": round(float(dias_promedio_pago), 1) if dias_promedio_pago is not None else None,
        "facturas": [model_to_dict(f) for f in facturas],
        "casos_facturacion": [model_to_dict(c) for c in casos_fact],
        "casos_cobranza": [model_to_dict(c) for c in casos_cob],
        "comunicaciones": [model_to_dict(e) for e in emails],
    })
