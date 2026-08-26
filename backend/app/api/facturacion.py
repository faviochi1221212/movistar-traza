from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.serialization import model_to_dict, to_jsonable
from app.models.models import CasoFacturacion, ClienteB2B, Conformidad, FacturaB2B, ValidacionFacturacion
from app.services import facturacion

router = APIRouter(prefix="/api/facturacion", tags=["facturacion"])


@router.get("/resumen")
def resumen(db: Session = Depends(get_db)):
    return facturacion.resumen_ciclo(db)


@router.get("/validaciones")
def validaciones(resultado: str | None = None, limit: int = 50, offset: int = 0, db: Session = Depends(get_db)):
    q = db.query(ValidacionFacturacion).join(ClienteB2B, ValidacionFacturacion.cliente_id == ClienteB2B.id)
    if resultado and resultado != "TODOS":
        q = q.filter(ValidacionFacturacion.resultado == resultado)
    rows = q.order_by(ValidacionFacturacion.created_at.desc()).offset(offset).limit(limit).all()
    out = []
    for v in rows:
        d = model_to_dict(v)
        cliente = db.query(ClienteB2B).get(v.cliente_id)
        d["cliente_nombre"] = cliente.razon_social if cliente else None
        out.append(d)
    return out


@router.get("/casos")
def casos(estado: str | None = None, limit: int = 50, offset: int = 0, db: Session = Depends(get_db)):
    q = db.query(CasoFacturacion)
    if estado and estado != "TODOS":
        q = q.filter(CasoFacturacion.estado == estado)
    else:
        q = q.filter(CasoFacturacion.estado.in_(["ABIERTO", "EN_REVISION"]))
    rows = q.order_by(CasoFacturacion.prioridad.desc(), CasoFacturacion.created_at.desc()).offset(offset).limit(limit).all()
    result = []
    for c in rows:
        d = model_to_dict(c)
        d["cliente_nombre"] = c.cliente.razon_social if c.cliente else None
        d["factura_numero"] = c.factura.numero if c.factura else None
        result.append(d)
    return result


@router.get("/casos/{caso_id}")
def caso_detalle(caso_id: str, db: Session = Depends(get_db)):
    caso = db.query(CasoFacturacion).get(caso_id)
    if not caso:
        raise HTTPException(404, "Caso no encontrado")
    d = model_to_dict(caso)
    d["cliente_nombre"] = caso.cliente.razon_social if caso.cliente else None
    d["factura_numero"] = caso.factura.numero if caso.factura else None
    return d


class ResolverCasoBody(BaseModel):
    resolucion: str | None = None
    accion: str = "CREAR_TAREA"  # CREAR_TAREA | DESCARTAR


@router.post("/casos/{caso_id}/resolver")
def resolver_caso(caso_id: str, body: ResolverCasoBody, db: Session = Depends(get_db)):
    caso = db.query(CasoFacturacion).get(caso_id)
    if not caso:
        raise HTTPException(404, "Caso no encontrado")
    caso.estado = "DESCARTADO" if body.accion == "DESCARTAR" else "EN_REVISION"
    caso.resolucion = body.resolucion
    db.commit()
    return model_to_dict(caso)


@router.get("/conformidades")
def conformidades(estado: str | None = None, db: Session = Depends(get_db)):
    q = db.query(Conformidad)
    if estado and estado != "TODOS":
        q = q.filter(Conformidad.estado == estado)
    rows = q.order_by(Conformidad.created_at.desc()).limit(100).all()
    out = []
    for c in rows:
        d = model_to_dict(c)
        d["factura_numero"] = c.factura.numero if c.factura else None
        d["cliente_nombre"] = c.cliente.razon_social if c.cliente else None
        out.append(d)
    return out


@router.get("/conformidades/{factura_id}")
def conformidad_detalle(factura_id: str, db: Session = Depends(get_db)):
    conformidad = db.query(Conformidad).filter(Conformidad.factura_id == factura_id).first()
    if not conformidad:
        raise HTTPException(404, "No existe conformidad para esta factura")
    d = model_to_dict(conformidad)
    from app.models.models import ConformidadEvento
    eventos = db.query(ConformidadEvento).filter(ConformidadEvento.conformidad_id == conformidad.id).order_by(ConformidadEvento.created_at.asc()).all()
    d["eventos"] = [model_to_dict(e) for e in eventos]
    return d


@router.post("/facturas/{factura_id}/solicitar-conformidad")
def solicitar_conformidad(factura_id: str, db: Session = Depends(get_db)):
    factura = db.query(FacturaB2B).get(factura_id)
    if not factura:
        raise HTTPException(404, "Factura no encontrada")
    conformidad = facturacion.crear_solicitud_conformidad(db, factura)
    db.commit()
    return model_to_dict(conformidad)


@router.post("/conformidades/{conformidad_id}/recordatorio")
def recordatorio(conformidad_id: str, db: Session = Depends(get_db)):
    conformidad = db.query(Conformidad).get(conformidad_id)
    if not conformidad:
        raise HTTPException(404, "Conformidad no encontrada")
    facturacion.enviar_recordatorio(db, conformidad)
    db.commit()
    return model_to_dict(conformidad)


class RespuestaConformidadBody(BaseModel):
    respuesta: str


@router.post("/conformidades/{conformidad_id}/respuesta")
def respuesta_conformidad(conformidad_id: str, body: RespuestaConformidadBody, db: Session = Depends(get_db)):
    conformidad = db.query(Conformidad).get(conformidad_id)
    if not conformidad:
        raise HTTPException(404, "Conformidad no encontrada")
    facturacion.procesar_respuesta_conformidad(db, conformidad, body.respuesta)
    db.commit()
    return model_to_dict(conformidad)


@router.get("/emision")
def emision(tipo_factura: str | None = None, db: Session = Depends(get_db)):
    q = db.query(FacturaB2B).filter(
        FacturaB2B.estado.in_(["VALIDANDO", "APROBADO", "ESPERANDO_CONFORMIDAD", "SIN_RESPUESTA", "OBSERVADO", "GENERADO", "LISTO_EMISION"])
    )
    if tipo_factura and tipo_factura != "TODOS":
        q = q.filter(FacturaB2B.tipo_factura == tipo_factura)
    facturas = q.order_by(FacturaB2B.fecha_vencimiento.asc()).limit(100).all()
    out = []
    for f in facturas:
        conformidad = db.query(Conformidad).filter(Conformidad.factura_id == f.id).first()
        ok, motivo = facturacion.puede_emitir(f, conformidad)
        out.append({
            **model_to_dict(f),
            "cliente_nombre": f.cliente.razon_social if f.cliente else None,
            "conformidad_estado": conformidad.estado if conformidad else "NO_APLICA",
            "puede_emitir": ok,
            "motivo": motivo,
        })
    return out


@router.post("/facturas/{factura_id}/emitir")
def emitir(factura_id: str, db: Session = Depends(get_db)):
    factura = db.query(FacturaB2B).get(factura_id)
    if not factura:
        raise HTTPException(404, "Factura no encontrada")
    try:
        facturacion.emitir_factura(db, factura)
    except ValueError as exc:
        raise HTTPException(409, str(exc))
    db.commit()
    return model_to_dict(factura)


@router.post("/procesar-lote")
def procesar_lote(limit: int = 300, db: Session = Depends(get_db)):
    """Ejecuta el motor de validaciones/casos reales sobre facturas aun no procesadas."""
    facturas = (
        db.query(FacturaB2B)
        .outerjoin(ValidacionFacturacion, ValidacionFacturacion.factura_id == FacturaB2B.id)
        .filter(ValidacionFacturacion.id.is_(None))
        .limit(limit)
        .all()
    )
    total = 0
    for f in facturas:
        facturacion.validar_factura(db, f, f.cliente)
        total += 1
    detectados = facturacion.detectar_servicio_no_facturado(db)
    vencidas = facturacion.marcar_sin_respuesta_vencidas(db)
    db.commit()
    return {"facturas_validadas": total, "casos_servicio_no_facturado": detectados, "conformidades_vencidas": vencidas}
