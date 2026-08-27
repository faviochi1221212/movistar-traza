from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.serialization import model_to_dict, to_jsonable
from app.models.models import CasoFacturacion, ClienteB2B, Conformidad, FacturaB2B, ValidacionFacturacion
from app.services import facturacion

router = APIRouter(prefix="/api/facturacion", tags=["facturacion"])


@router.get("/resumen")
def resumen(db: Session = Depends(get_db)):
    return facturacion.resumen_ciclo(db)


@router.get("/facturas")
def listar_facturas(limit: int = 3000, db: Session = Depends(get_db)):
    """Dataset amplio (todas las facturas, cualquier estado) para que el
    asistente de Facturacion pueda calcular agregados reales por periodo
    (cuantas/cuanto se facturo en un mes, promedios, etc.), no solo sobre
    las pendientes de emision."""
    rows = (
        db.query(FacturaB2B, ClienteB2B.razon_social)
        .join(ClienteB2B, FacturaB2B.cliente_id == ClienteB2B.id)
        .order_by(FacturaB2B.fecha_emision.desc())
        .limit(limit)
        .all()
    )
    out = []
    for f, razon_social in rows:
        out.append({
            "id": str(f.id), "numero": f.numero, "cliente_nombre": razon_social,
            "monto": float(f.monto), "tipo_factura": f.tipo_factura, "estado": f.estado,
            "fecha_emision": to_jsonable(f.fecha_emision), "fecha_vencimiento": to_jsonable(f.fecha_vencimiento),
            "fuente": f.fuente,
        })
    return out


@router.get("/validaciones")
def validaciones(resultado: str | None = None, limit: int = 50, offset: int = 0, db: Session = Depends(get_db)):
    q = (
        db.query(ValidacionFacturacion, ClienteB2B.razon_social, FacturaB2B.numero)
        .join(ClienteB2B, ValidacionFacturacion.cliente_id == ClienteB2B.id)
        .outerjoin(FacturaB2B, ValidacionFacturacion.factura_id == FacturaB2B.id)
    )
    if resultado and resultado != "TODOS":
        q = q.filter(ValidacionFacturacion.resultado == resultado)
    rows = q.order_by(ValidacionFacturacion.created_at.desc()).offset(offset).limit(limit).all()
    out = []
    for v, razon_social, factura_numero in rows:
        d = model_to_dict(v)
        d["cliente_nombre"] = razon_social
        d["factura_numero"] = factura_numero
        out.append(d)
    return out


@router.get("/facturas/{factura_id}")
def factura_detalle(factura_id: str, db: Session = Depends(get_db)):
    factura = db.query(FacturaB2B).options(joinedload(FacturaB2B.cliente)).get(factura_id)
    if not factura:
        raise HTTPException(404, "Factura no encontrada")
    conformidad = db.query(Conformidad).filter(Conformidad.factura_id == factura.id).first()
    validaciones_factura = (
        db.query(ValidacionFacturacion)
        .filter(ValidacionFacturacion.factura_id == factura.id)
        .order_by(ValidacionFacturacion.created_at.asc())
        .all()
    )
    d = model_to_dict(factura)
    d["cliente_nombre"] = factura.cliente.razon_social if factura.cliente else None
    d["conformidad_estado"] = conformidad.estado if conformidad else "NO_APLICA"
    d["validaciones"] = [model_to_dict(v) for v in validaciones_factura]
    return d


class CrearFacturaCorreoBody(BaseModel):
    cliente_nombre: str
    ruc: str
    monto: float
    servicio: str | None = None
    periodo: str | None = None
    orden: str | None = None
    fecha_emision: str | None = None  # "DD/MM/YYYY"
    tipo_factura: str = "ACICLICA"


@router.post("/facturas/desde-correo")
def crear_factura_desde_correo(body: CrearFacturaCorreoBody, db: Session = Depends(get_db)):
    fecha = None
    if body.fecha_emision:
        try:
            fecha = datetime.strptime(body.fecha_emision, "%d/%m/%Y").date()
        except ValueError:
            fecha = None
    tipo_factura = body.tipo_factura if body.tipo_factura in ("CICLICA", "ACICLICA") else "ACICLICA"
    try:
        factura = facturacion.crear_factura_desde_correo(
            db, cliente_nombre=body.cliente_nombre, ruc=body.ruc, monto=Decimal(str(body.monto)),
            servicio=body.servicio, periodo=body.periodo, orden=body.orden,
            fecha_emision=fecha, tipo_factura=tipo_factura,
        )
        db.commit()
    except Exception:
        db.rollback()
        raise

    return {"factura_id": str(factura.id), "factura_numero": factura.numero, "cliente_nombre": body.cliente_nombre}


@router.get("/casos")
def casos(estado: str | None = None, limit: int = 50, offset: int = 0, db: Session = Depends(get_db)):
    q = db.query(CasoFacturacion).options(joinedload(CasoFacturacion.cliente), joinedload(CasoFacturacion.factura))
    if estado and estado != "TODOS":
        q = q.filter(CasoFacturacion.estado == estado)
    else:
        q = q.filter(CasoFacturacion.estado.in_(["ABIERTO", "EN_REVISION"]))
    rows = q.order_by(CasoFacturacion.prioridad.desc(), CasoFacturacion.created_at.desc()).offset(offset).limit(limit).all()

    # Los casos SERVICIO_ACTIVO_SIN_FACTURACION no tienen factura (el problema es
    # justamente la ausencia de facturacion), asi que su "fuente" real es de donde
    # proviene el servicio activo detectado: Planta Fija o Planta Movil.
    sin_factura_ids = list({c.cliente_id for c in rows if not c.factura_id})
    fija_ids: set = set()
    movil_ids: set = set()
    if sin_factura_ids:
        from app.models.models import PlantaFijaB2B, PlantaMovilB2B
        fija_ids = {r[0] for r in db.query(PlantaFijaB2B.cliente_id).filter(
            PlantaFijaB2B.cliente_id.in_(sin_factura_ids), PlantaFijaB2B.status_desc == "Active").all()}
        movil_ids = {r[0] for r in db.query(PlantaMovilB2B.cliente_id).filter(
            PlantaMovilB2B.cliente_id.in_(sin_factura_ids), PlantaMovilB2B.estado_linea == "Active").all()}

    result = []
    for c in rows:
        d = model_to_dict(c)
        d["cliente_nombre"] = c.cliente.razon_social if c.cliente else None
        d["factura_numero"] = c.factura.numero if c.factura else None
        if c.factura:
            d["factura_fuente"] = c.factura.fuente
        elif c.cliente_id in fija_ids and c.cliente_id in movil_ids:
            d["factura_fuente"] = "PLANTA_FIJA_Y_MOVIL"
        elif c.cliente_id in fija_ids:
            d["factura_fuente"] = "PLANTA_FIJA"
        elif c.cliente_id in movil_ids:
            d["factura_fuente"] = "PLANTA_MOVIL"
        else:
            d["factura_fuente"] = None
        result.append(d)
    return result


@router.get("/comunicaciones")
def comunicaciones(db: Session = Depends(get_db)):
    """Reclamos/consultas relacionados con facturas de Facturacion, provenientes
    de las comunicaciones que clasifica el Agente de Cobranzas (mismo dominio
    de facturas B2B, seccion 11/16 del prompt de rediseno de Emision)."""
    from app.models.models import EmailCobranza

    rows = (
        db.query(EmailCobranza, ClienteB2B.razon_social, FacturaB2B.numero)
        .join(FacturaB2B, EmailCobranza.factura_id == FacturaB2B.id)
        .outerjoin(ClienteB2B, EmailCobranza.cliente_id == ClienteB2B.id)
        .filter(EmailCobranza.clasificacion.in_(["RECLAMO", "CONSULTA", "NOTA_CREDITO"]))
        .order_by(EmailCobranza.recibido_at.desc())
        .limit(200)
        .all()
    )
    out = []
    for e, razon_social, factura_numero in rows:
        out.append({
            "id": str(e.id), "cliente_nombre": razon_social, "factura_numero": factura_numero,
            "clasificacion": e.clasificacion, "asunto": e.asunto, "recibido_at": to_jsonable(e.recibido_at),
        })
    return out


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
    d["factura_numero"] = conformidad.factura.numero if conformidad.factura else None
    d["monto"] = float(conformidad.factura.monto) if conformidad.factura else None
    d["cliente_nombre"] = conformidad.cliente.razon_social if conformidad.cliente else None
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
    q = db.query(FacturaB2B).options(joinedload(FacturaB2B.cliente)).filter(
        FacturaB2B.estado.in_(["VALIDANDO", "APROBADO", "ESPERANDO_CONFORMIDAD", "SIN_RESPUESTA", "OBSERVADO", "GENERADO", "LISTO_EMISION"])
    )
    if tipo_factura and tipo_factura != "TODOS":
        q = q.filter(FacturaB2B.tipo_factura == tipo_factura)
    facturas = q.order_by(FacturaB2B.fecha_vencimiento.asc()).limit(100).all()
    conformidades_por_factura = {
        c.factura_id: c
        for c in db.query(Conformidad).filter(Conformidad.factura_id.in_([f.id for f in facturas])).all()
    }
    out = []
    for f in facturas:
        conformidad = conformidades_por_factura.get(f.id)
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
