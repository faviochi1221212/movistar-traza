"""Agente de Facturacion: validaciones, casos, conformidad y emision.

APROBADO en una factura es conformidad de Facturacion; nunca significa pagada
(seccion 9/10 del prompt maestro). El pago real vive en pagos_b2b +
conciliaciones + aplicaciones_pago (services/conciliacion.py).
"""
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.models import (
    CasoFacturacion, ClienteB2B, Conformidad, ConformidadEvento, CuentaB2B,
    FacturaB2B, PlantaFijaB2B, PlantaMovilB2B, TrazaCicloIngreso, ValidacionFacturacion,
)
from app.services import audit
from app.services.rules import get_regla

UMBRAL_ACICLICA = Decimal("5000")
APROBACION_KEYWORDS = ("aprobar", "aprobado", "autorizo", "autorizado", "conforme")


def clasificar_tipo_factura(monto_neto: Decimal) -> str:
    """Regla simplificada de MVP (no hay indicador de ciclo en el dataset origen):
    una factura acicilca es aquella cuyo monto excede el umbral configurado,
    ya que en la practica ese es el caso que exige conformidad previa."""
    return "ACICLICA" if monto_neto > UMBRAL_ACICLICA else "CICLICA"


def _crear_caso(db: Session, *, cliente_id, factura_id, tipo_caso, asunto, descripcion, impacto_monto, prioridad="MEDIA"):
    codigo = f"CF-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{cliente_id.hex[:6]}-{tipo_caso[:4]}"
    existing = db.query(CasoFacturacion).filter(CasoFacturacion.codigo == codigo).first()
    if existing:
        return existing
    caso = CasoFacturacion(
        codigo=codigo, cliente_id=cliente_id, factura_id=factura_id, tipo_caso=tipo_caso,
        asunto=asunto, descripcion=descripcion, impacto_monto=impacto_monto, prioridad=prioridad,
    )
    db.add(caso)
    db.flush()
    audit.log(db, actor_tipo="AGENT", actor_id="FACTURACION", accion="CREAR_CASO_FACTURACION",
               entidad_tipo="casos_facturacion", entidad_id=caso.id, after_data={"tipo_caso": tipo_caso, "asunto": asunto})
    return caso


def validar_factura(db: Session, factura: FacturaB2B, cliente: ClienteB2B) -> list[ValidacionFacturacion]:
    """Ejecuta las validaciones minimas de la seccion 10 sobre una factura y
    persiste el resultado. Idempotente: no re-valida si ya existe un registro."""
    ya_validada = db.query(ValidacionFacturacion).filter(ValidacionFacturacion.factura_id == factura.id).first()
    if ya_validada:
        return [ya_validada]

    checks: list[tuple[str, str, str | None]] = []
    if not cliente.activo:
        checks.append(("CLIENTE_ACTIVO", "ERROR", "El cliente no se encuentra activo."))
    else:
        checks.append(("CLIENTE_ACTIVO", "CORRECTO", None))

    if factura.moneda != "PEN":
        checks.append(("MONEDA", "OBSERVACION", f"Moneda inusual: {factura.moneda}."))
    else:
        checks.append(("MONEDA", "CORRECTO", None))

    if factura.monto <= 0:
        checks.append(("MONTO_VALIDO", "ERROR", "El monto facturado no es positivo."))
    else:
        checks.append(("MONTO_VALIDO", "CORRECTO", None))

    if factura.fecha_vencimiento < factura.fecha_emision:
        checks.append(("PERIODO_COHERENTE", "ERROR", "La fecha de vencimiento es anterior a la emision."))
    else:
        checks.append(("PERIODO_COHERENTE", "CORRECTO", None))

    diff = abs((factura.monto - factura.monto_neto) - factura.igv)
    if diff > Decimal("0.05"):
        checks.append(("CONSISTENCIA_ARITMETICA", "OBSERVACION", "El neto + IGV no cuadra exactamente con el monto total."))
    else:
        checks.append(("CONSISTENCIA_ARITMETICA", "CORRECTO", None))

    resultados = []
    for tipo, resultado, obs in checks:
        v = ValidacionFacturacion(
            factura_id=factura.id, cliente_id=cliente.id, tipo_validacion=tipo,
            resultado=resultado, observacion=obs, regla_codigo=tipo,
            fuentes=["TBL_CLIENTES_B2B", "FACTURACION"],
        )
        db.add(v)
        resultados.append(v)

        if resultado in ("ERROR", "OBSERVACION"):
            _crear_caso(
                db, cliente_id=cliente.id, factura_id=factura.id,
                tipo_caso=tipo, asunto=obs or tipo, descripcion=obs,
                impacto_monto=factura.monto, prioridad="ALTA" if resultado == "ERROR" else "MEDIA",
            )
    db.flush()
    return resultados


def detectar_servicio_no_facturado(db: Session, dias_sin_factura: int = 45) -> int:
    """Servicios activos cuya cuenta no registra ninguna factura reciente."""
    limite = datetime.now(timezone.utc).date() - timedelta(days=dias_sin_factura)
    creados = 0
    cuentas_con_servicio_activo = (
        db.query(CuentaB2B)
        .join(PlantaFijaB2B, PlantaFijaB2B.cuenta_id == CuentaB2B.id, isouter=True)
        .join(PlantaMovilB2B, PlantaMovilB2B.cuenta_id == CuentaB2B.id, isouter=True)
        .filter((PlantaFijaB2B.status_desc == "Active") | (PlantaMovilB2B.estado_linea == "Active"))
        .distinct()
        .limit(500)
        .all()
    )
    for cuenta in cuentas_con_servicio_activo:
        ultima_factura = (
            db.query(func.max(FacturaB2B.fecha_emision))
            .filter(FacturaB2B.cuenta_id == cuenta.id)
            .scalar()
        )
        if ultima_factura is not None and ultima_factura >= limite:
            continue
        _crear_caso(
            db, cliente_id=cuenta.cliente_id, factura_id=None,
            tipo_caso="SERVICIO_ACTIVO_SIN_FACTURACION",
            asunto="Servicio activo sin facturacion reciente",
            descripcion=f"La cuenta {cuenta.cod_cuenta} tiene un servicio activo pero no registra facturacion en los ultimos {dias_sin_factura} dias.",
            impacto_monto=None, prioridad="ALTA",
        )
        creados += 1
    db.flush()
    return creados


def resumen_ciclo(db: Session) -> dict:
    total_validaciones = db.query(func.count(ValidacionFacturacion.id)).scalar() or 0
    correctas = db.query(func.count(ValidacionFacturacion.id)).filter(ValidacionFacturacion.resultado == "CORRECTO").scalar() or 0
    en_revision = db.query(func.count(ValidacionFacturacion.id)).filter(ValidacionFacturacion.resultado != "CORRECTO").scalar() or 0

    casos_abiertos = db.query(func.count(CasoFacturacion.id)).filter(CasoFacturacion.estado.in_(["ABIERTO", "EN_REVISION"])).scalar() or 0

    conformidad_pendiente = db.query(func.count(Conformidad.id)).filter(Conformidad.estado == "PENDIENTE").scalar() or 0

    emitidas = db.query(func.count(FacturaB2B.id)).filter(FacturaB2B.estado == "EMITIDO").scalar() or 0
    monto_emitido = db.query(func.coalesce(func.sum(FacturaB2B.monto), 0)).filter(FacturaB2B.estado == "EMITIDO").scalar() or 0

    criticos = db.query(func.count(CasoFacturacion.id)).filter(CasoFacturacion.prioridad == "ALTA", CasoFacturacion.estado == "ABIERTO").scalar() or 0

    return {
        "validacion": {"correctas": correctas, "en_revision": en_revision, "total": total_validaciones},
        "conformidad": {"pendientes": conformidad_pendiente},
        "emision": {"emitidas": emitidas, "monto_emitido": float(monto_emitido)},
        "control": {"casos_abiertos": casos_abiertos, "casos_criticos": criticos},
    }


def crear_solicitud_conformidad(db: Session, factura: FacturaB2B) -> Conformidad:
    conformidad = db.query(Conformidad).filter(Conformidad.factura_id == factura.id).first()
    if conformidad:
        return conformidad
    conformidad = Conformidad(
        factura_id=factura.id, cliente_id=factura.cliente_id, estado="PENDIENTE",
        canal="OUTLOOK", enviada_at=datetime.now(timezone.utc),
    )
    db.add(conformidad)
    db.flush()
    db.add(ConformidadEvento(conformidad_id=conformidad.id, tipo_evento="ENVIADO", detalle="Solicitud de conformidad enviada al cliente."))
    factura.estado = "ESPERANDO_CONFORMIDAD"
    db.flush()
    audit.log(db, actor_tipo="AGENT", actor_id="FACTURACION", accion="ENVIAR_SOLICITUD_CONFORMIDAD",
               entidad_tipo="conformidades", entidad_id=conformidad.id)
    return conformidad


def enviar_recordatorio(db: Session, conformidad: Conformidad) -> Conformidad:
    conformidad.ultimo_recordatorio_at = datetime.now(timezone.utc)
    db.add(ConformidadEvento(conformidad_id=conformidad.id, tipo_evento="RECORDATORIO", detalle="Recordatorio enviado al cliente."))
    db.flush()
    audit.log(db, actor_tipo="USER", accion="ENVIAR_RECORDATORIO_CONFORMIDAD", entidad_tipo="conformidades", entidad_id=conformidad.id)
    return conformidad


def procesar_respuesta_conformidad(db: Session, conformidad: Conformidad, respuesta_texto: str) -> Conformidad:
    texto = respuesta_texto.lower()
    aprobado = any(kw in texto for kw in APROBACION_KEYWORDS)
    conformidad.respuesta_cliente = respuesta_texto
    conformidad.respondida_at = datetime.now(timezone.utc)
    conformidad.estado = "APROBADO" if aprobado else "OBSERVADO"
    tipo_evento = "APROBADO" if aprobado else "OBSERVADO"
    db.add(ConformidadEvento(conformidad_id=conformidad.id, tipo_evento=tipo_evento, detalle=respuesta_texto))

    factura = db.query(FacturaB2B).get(conformidad.factura_id)
    if factura:
        factura.estado = "APROBADO" if aprobado else "OBSERVADO"
    db.flush()
    audit.log(db, actor_tipo="USER", accion="PROCESAR_RESPUESTA_CONFORMIDAD",
               entidad_tipo="conformidades", entidad_id=conformidad.id, after_data={"estado": conformidad.estado})
    return conformidad


def marcar_sin_respuesta_vencidas(db: Session) -> int:
    horas_sin_respuesta = float(get_regla(db, "CONFORMIDAD_SIN_RESPUESTA_HORAS") or 120)
    limite = datetime.now(timezone.utc) - timedelta(hours=horas_sin_respuesta)
    pendientes = db.query(Conformidad).filter(Conformidad.estado == "PENDIENTE", Conformidad.enviada_at <= limite).all()
    for c in pendientes:
        c.estado = "SIN_RESPUESTA"
        db.add(ConformidadEvento(conformidad_id=c.id, tipo_evento="SIN_RESPUESTA", detalle="Sin respuesta del cliente dentro del plazo configurado."))
        factura = db.query(FacturaB2B).get(c.factura_id)
        if factura:
            factura.estado = "SIN_RESPUESTA"
    db.flush()
    return len(pendientes)


def puede_emitir(factura: FacturaB2B, conformidad: Conformidad | None) -> tuple[bool, str]:
    if factura.estado == "EMITIDO":
        return False, "Ya emitida"
    if factura.tipo_factura == "CICLICA":
        return True, "Cíclica validada"
    if conformidad and conformidad.estado == "APROBADO":
        return True, "Acíclica con conformidad aprobada"
    return False, "Pendiente de conformidad"


def emitir_factura(db: Session, factura: FacturaB2B) -> FacturaB2B:
    conformidad = db.query(Conformidad).filter(Conformidad.factura_id == factura.id).first()
    ok, motivo = puede_emitir(factura, conformidad)
    if not ok:
        raise ValueError(f"No se puede emitir: {motivo}")

    factura.estado = "EMITIDO"
    factura.fecha_emision_real = datetime.now(timezone.utc)
    db.flush()

    traza = db.query(TrazaCicloIngreso).filter(TrazaCicloIngreso.factura_id == factura.id).first()
    if not traza:
        traza = TrazaCicloIngreso(cliente_id=factura.cliente_id, factura_id=factura.id, estado_general="ACTIVA")
        db.add(traza)
        db.flush()

    audit.log(db, actor_tipo="USER", accion="EMITIR_FACTURA", entidad_tipo="facturas_b2b",
               entidad_id=factura.id, after_data={"estado": "EMITIDO"}, trace_id=traza.id)
    return factura
