"""Modelos SQLAlchemy alineados 1:1 con TRAZA_FINAL_SCHEMA.sql.

No se regenera el schema desde el ORM: estas clases se adaptan al SQL ya
aplicado en Supabase, no al revés (ver seccion 8 del prompt maestro).
"""
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean, CheckConstraint, Column, Date, DateTime, ForeignKey,
    Numeric, String, Text, UniqueConstraint, text, BigInteger, Integer,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import relationship

from app.core.database import Base


def uuid_pk():
    return Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))


class ClienteB2B(Base):
    __tablename__ = "clientes_b2b"
    id = uuid_pk()
    segmento_pais = Column(String)
    tipo_documento = Column(String, default="RUC")
    numero_identificacion_fiscal = Column(String, nullable=False, unique=True)
    razon_social = Column(String, nullable=False)
    sunat_estado_ruc = Column(String)
    sunat_estado_contribuyente = Column(String)
    sunat_departamento = Column(String)
    sunat_provincia = Column(String)
    sunat_distrito = Column(String)
    activo = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=text("now()"))
    updated_at = Column(DateTime(timezone=True), server_default=text("now()"))


class CuentaB2B(Base):
    __tablename__ = "cuentas_b2b"
    id = uuid_pk()
    cliente_id = Column(UUID(as_uuid=True), ForeignKey("clientes_b2b.id", ondelete="CASCADE"), nullable=False)
    cod_cliente = Column(String, nullable=False)
    cod_cuenta = Column(String, nullable=False)
    sistema = Column(String)
    activo = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=text("now()"))
    updated_at = Column(DateTime(timezone=True), server_default=text("now()"))


class PlantaFijaB2B(Base):
    __tablename__ = "planta_fija_b2b"
    id = uuid_pk()
    cliente_id = Column(UUID(as_uuid=True), ForeignKey("clientes_b2b.id", ondelete="CASCADE"), nullable=False)
    cuenta_id = Column(UUID(as_uuid=True), ForeignKey("cuentas_b2b.id", ondelete="SET NULL"))
    ciclo = Column(Integer)
    fecha_alta = Column(DateTime(timezone=True))
    status_desc = Column(String)
    ln_plan_desc = Column(String)
    ln_subscriber_status_desc = Column(String)
    int_plan_desc = Column(String)
    int_original_activation_date = Column(DateTime(timezone=True))
    tv_plan_desc = Column(String)
    tv_original_activation_date = Column(DateTime(timezone=True))
    tv_tecnologia = Column(String)
    tv_service_technology = Column(String)
    tv_subscriber_status_desc = Column(String)
    sub_main_offer_desc = Column(String)
    int_subscriber_status_desc = Column(String)
    sub_main_offer_trioduo = Column(String)
    es_movistartotal = Column(Boolean)
    descuento_promocion_producto_desc = Column(String)
    decos_cantidad = Column(Integer)
    created_at = Column(DateTime(timezone=True), server_default=text("now()"))
    updated_at = Column(DateTime(timezone=True), server_default=text("now()"))


class PlantaMovilB2B(Base):
    __tablename__ = "planta_movil_b2b"
    id = uuid_pk()
    cliente_id = Column(UUID(as_uuid=True), ForeignKey("clientes_b2b.id", ondelete="CASCADE"), nullable=False)
    cuenta_id = Column(UUID(as_uuid=True), ForeignKey("cuentas_b2b.id", ondelete="SET NULL"))
    flag_staff = Column(String)
    producto = Column(String)
    fecha_alta = Column(Date)
    estado_linea = Column(String)
    estado_telefono_razon = Column(String)
    tipo_linea = Column(String)
    product_desc = Column(String)
    plan_principal = Column(String)
    cant_promociones = Column(Integer)
    prom_dscto = Column(Numeric(14, 2))
    plan_roaming_datos = Column(String)
    fecha_inicio_permanencia = Column(Date)
    fecha_fin_permanencia = Column(Date)
    meses_permanencia = Column(Integer)
    created_at = Column(DateTime(timezone=True), server_default=text("now()"))
    updated_at = Column(DateTime(timezone=True), server_default=text("now()"))


class FacturaB2B(Base):
    __tablename__ = "facturas_b2b"
    id = uuid_pk()
    numero = Column(String, nullable=False)
    cliente_id = Column(UUID(as_uuid=True), ForeignKey("clientes_b2b.id"), nullable=False)
    cuenta_id = Column(UUID(as_uuid=True), ForeignKey("cuentas_b2b.id", ondelete="SET NULL"))
    fuente = Column(String)
    sistema = Column(String)
    fecha_emision = Column(Date, nullable=False)
    fecha_vencimiento = Column(Date, nullable=False)
    moneda = Column(String(3), nullable=False, default="PEN")
    monto_neto = Column(Numeric(18, 2), nullable=False, default=0)
    igv = Column(Numeric(18, 2), nullable=False, default=0)
    monto = Column(Numeric(18, 2), nullable=False)
    tipo_factura = Column(String, nullable=False, default="CICLICA")
    requiere_conformidad = Column(Boolean, nullable=False, default=False)
    estado = Column(String, nullable=False, default="GENERADO")
    fecha_emision_real = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=text("now()"))
    updated_at = Column(DateTime(timezone=True), server_default=text("now()"))

    cliente = relationship("ClienteB2B")


class NotaCreditoB2B(Base):
    __tablename__ = "notas_credito_b2b"
    id = uuid_pk()
    numero = Column(String, nullable=False)
    cliente_id = Column(UUID(as_uuid=True), ForeignKey("clientes_b2b.id"), nullable=False)
    cuenta_id = Column(UUID(as_uuid=True), ForeignKey("cuentas_b2b.id", ondelete="SET NULL"))
    factura_id = Column(UUID(as_uuid=True), ForeignKey("facturas_b2b.id", ondelete="SET NULL"))
    fuente = Column(String, default="NOTA DE CREDITO")
    sistema = Column(String)
    fecha_emision = Column(Date, nullable=False)
    moneda = Column(String(3), nullable=False, default="PEN")
    monto_sin_igv = Column(Numeric(18, 2), nullable=False, default=0)
    igv = Column(Numeric(18, 2), nullable=False, default=0)
    monto = Column(Numeric(18, 2), nullable=False)
    estado = Column(String, nullable=False, default="REGISTRADA")
    motivo = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=text("now()"))
    updated_at = Column(DateTime(timezone=True), server_default=text("now()"))


class AplicacionNotaCredito(Base):
    __tablename__ = "aplicaciones_nota_credito"
    id = uuid_pk()
    nota_credito_id = Column(UUID(as_uuid=True), ForeignKey("notas_credito_b2b.id", ondelete="CASCADE"), nullable=False)
    factura_id = Column(UUID(as_uuid=True), ForeignKey("facturas_b2b.id", ondelete="CASCADE"), nullable=False)
    monto_aplicado = Column(Numeric(18, 2), nullable=False)
    fecha_aplicacion = Column(DateTime(timezone=True), server_default=text("now()"))
    created_at = Column(DateTime(timezone=True), server_default=text("now()"))


class ValidacionFacturacion(Base):
    __tablename__ = "validaciones_facturacion"
    id = uuid_pk()
    factura_id = Column(UUID(as_uuid=True), ForeignKey("facturas_b2b.id", ondelete="CASCADE"))
    cliente_id = Column(UUID(as_uuid=True), ForeignKey("clientes_b2b.id"), nullable=False)
    tipo_validacion = Column(String, nullable=False)
    resultado = Column(String, nullable=False)
    observacion = Column(String)
    evidencia = Column(JSONB, nullable=False, default=dict)
    fuentes = Column(JSONB, nullable=False, default=list)
    regla_codigo = Column(String)
    ejecutado_por = Column(String, default="AGENTE_FACTURACION")
    created_at = Column(DateTime(timezone=True), server_default=text("now()"))


class CasoFacturacion(Base):
    __tablename__ = "casos_facturacion"
    id = uuid_pk()
    codigo = Column(String, nullable=False, unique=True)
    cliente_id = Column(UUID(as_uuid=True), ForeignKey("clientes_b2b.id"), nullable=False)
    factura_id = Column(UUID(as_uuid=True), ForeignKey("facturas_b2b.id", ondelete="SET NULL"))
    prioridad = Column(String, nullable=False, default="MEDIA")
    tipo_caso = Column(String, nullable=False)
    asunto = Column(String, nullable=False)
    descripcion = Column(Text)
    impacto_monto = Column(Numeric(18, 2))
    estado = Column(String, nullable=False, default="ABIERTO")
    requiere_revision_manual = Column(Boolean, nullable=False, default=True)
    responsable_id = Column(UUID(as_uuid=True))
    resolucion = Column(Text)
    resolved_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=text("now()"))
    updated_at = Column(DateTime(timezone=True), server_default=text("now()"))

    cliente = relationship("ClienteB2B")
    factura = relationship("FacturaB2B")


class Conformidad(Base):
    __tablename__ = "conformidades"
    id = uuid_pk()
    factura_id = Column(UUID(as_uuid=True), ForeignKey("facturas_b2b.id", ondelete="CASCADE"), nullable=False, unique=True)
    cliente_id = Column(UUID(as_uuid=True), ForeignKey("clientes_b2b.id"), nullable=False)
    estado = Column(String, nullable=False, default="PENDIENTE")
    canal = Column(String, nullable=False, default="OUTLOOK")
    outlook_message_id = Column(String)
    outlook_thread_id = Column(String)
    enviada_at = Column(DateTime(timezone=True))
    ultimo_recordatorio_at = Column(DateTime(timezone=True))
    respondida_at = Column(DateTime(timezone=True))
    respuesta_cliente = Column(Text)
    observacion = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=text("now()"))
    updated_at = Column(DateTime(timezone=True), server_default=text("now()"))

    factura = relationship("FacturaB2B")
    cliente = relationship("ClienteB2B")


class ConformidadEvento(Base):
    __tablename__ = "conformidad_eventos"
    id = uuid_pk()
    conformidad_id = Column(UUID(as_uuid=True), ForeignKey("conformidades.id", ondelete="CASCADE"), nullable=False)
    tipo_evento = Column(String, nullable=False)
    detalle = Column(Text)
    metadata_ = Column("metadata", JSONB, nullable=False, default=dict)
    created_at = Column(DateTime(timezone=True), server_default=text("now()"))


class PagoB2B(Base):
    __tablename__ = "pagos_b2b"
    id = uuid_pk()
    cliente_id = Column(UUID(as_uuid=True), ForeignKey("clientes_b2b.id"), nullable=False)
    cuenta_id = Column(UUID(as_uuid=True), ForeignKey("cuentas_b2b.id", ondelete="SET NULL"))
    factura_id = Column(UUID(as_uuid=True), ForeignKey("facturas_b2b.id", ondelete="SET NULL"))
    sistema = Column(String)
    fecha_pago = Column(Date, nullable=False)
    moneda = Column(String(3), nullable=False, default="PEN")
    subtotal = Column(Numeric(18, 2))
    igv = Column(Numeric(18, 2))
    monto = Column(Numeric(18, 2), nullable=False)
    medio = Column(String)
    referencia_operacion = Column(String)
    identificado = Column(Boolean, nullable=False, default=False)
    fuente = Column(String, nullable=False, default="CSV")
    created_at = Column(DateTime(timezone=True), server_default=text("now()"))
    updated_at = Column(DateTime(timezone=True), server_default=text("now()"))


class GestionCobranza(Base):
    __tablename__ = "gestiones_cobranza"
    id = uuid_pk()
    cliente_id = Column(UUID(as_uuid=True), ForeignKey("clientes_b2b.id"), nullable=False)
    factura_id = Column(UUID(as_uuid=True), ForeignKey("facturas_b2b.id", ondelete="CASCADE"), nullable=False, unique=True)
    estado = Column(String, nullable=False, default="PENDIENTE")
    prioridad = Column(String, nullable=False, default="MEDIA")
    responsable_id = Column(UUID(as_uuid=True))
    fecha_ultima_gestion = Column(DateTime(timezone=True))
    fecha_proxima_accion = Column(Date)
    notas = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=text("now()"))
    updated_at = Column(DateTime(timezone=True), server_default=text("now()"))

    cliente = relationship("ClienteB2B")
    factura = relationship("FacturaB2B")


class PromesaPago(Base):
    __tablename__ = "promesas_pago"
    id = uuid_pk()
    gestion_id = Column(UUID(as_uuid=True), ForeignKey("gestiones_cobranza.id", ondelete="CASCADE"))
    cliente_id = Column(UUID(as_uuid=True), ForeignKey("clientes_b2b.id"), nullable=False)
    factura_id = Column(UUID(as_uuid=True), ForeignKey("facturas_b2b.id", ondelete="SET NULL"))
    monto_prometido = Column(Numeric(18, 2), nullable=False)
    fecha_prometida = Column(Date, nullable=False)
    estado = Column(String, nullable=False, default="VIGENTE")
    origen = Column(String, nullable=False, default="EMAIL")
    observacion = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=text("now()"))
    updated_at = Column(DateTime(timezone=True), server_default=text("now()"))


class EmailCobranza(Base):
    __tablename__ = "emails_cobranza"
    id = uuid_pk()
    outlook_message_id = Column(String, unique=True)
    outlook_thread_id = Column(String)
    cliente_id = Column(UUID(as_uuid=True), ForeignKey("clientes_b2b.id", ondelete="SET NULL"))
    factura_id = Column(UUID(as_uuid=True), ForeignKey("facturas_b2b.id", ondelete="SET NULL"))
    remitente = Column(String, nullable=False)
    destinatarios = Column(ARRAY(String), nullable=False, server_default=text("ARRAY[]::text[]"))
    asunto = Column(String)
    cuerpo = Column(Text)
    recibido_at = Column(DateTime(timezone=True), nullable=False)
    adjuntos = Column(JSONB, nullable=False, default=list)
    clasificacion = Column(String)
    campos_extraidos = Column(JSONB, nullable=False, default=dict)
    confianza = Column(Numeric(5, 4))
    procesado = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), server_default=text("now()"))
    updated_at = Column(DateTime(timezone=True), server_default=text("now()"))

    cliente = relationship("ClienteB2B")
    factura = relationship("FacturaB2B")


class CasoCobranza(Base):
    __tablename__ = "casos_cobranza"
    id = uuid_pk()
    codigo = Column(String, nullable=False, unique=True)
    cliente_id = Column(UUID(as_uuid=True), ForeignKey("clientes_b2b.id"), nullable=False)
    factura_id = Column(UUID(as_uuid=True), ForeignKey("facturas_b2b.id", ondelete="SET NULL"))
    email_id = Column(UUID(as_uuid=True), ForeignKey("emails_cobranza.id", ondelete="SET NULL"))
    tipo_caso = Column(String, nullable=False)
    prioridad = Column(String, nullable=False, default="MEDIA")
    descripcion = Column(Text)
    impacto_monto = Column(Numeric(18, 2))
    estado = Column(String, nullable=False, default="ABIERTO")
    requiere_revision_manual = Column(Boolean, nullable=False, default=True)
    responsable_id = Column(UUID(as_uuid=True))
    resolucion = Column(Text)
    resolved_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=text("now()"))
    updated_at = Column(DateTime(timezone=True), server_default=text("now()"))

    cliente = relationship("ClienteB2B")
    factura = relationship("FacturaB2B")


class MovimientoBancarioDemo(Base):
    __tablename__ = "movimientos_bancarios_demo"
    id = uuid_pk()
    fecha_movimiento = Column(DateTime(timezone=True), nullable=False)
    banco = Column(String)
    cuenta_bancaria = Column(String)
    nro_operacion = Column(String)
    descripcion = Column(String)
    moneda = Column(String(3), nullable=False, default="PEN")
    monto = Column(Numeric(18, 2), nullable=False)
    tipo_movimiento = Column(String, nullable=False, default="ABONO")
    estado = Column(String, nullable=False, default="PENDIENTE")
    fuente = Column(String, nullable=False, default="DEMO")
    created_at = Column(DateTime(timezone=True), server_default=text("now()"))
    updated_at = Column(DateTime(timezone=True), server_default=text("now()"))


class MatchBancario(Base):
    __tablename__ = "matches_bancarios"
    id = uuid_pk()
    movimiento_id = Column(UUID(as_uuid=True), ForeignKey("movimientos_bancarios_demo.id", ondelete="CASCADE"), nullable=False)
    cliente_id = Column(UUID(as_uuid=True), ForeignKey("clientes_b2b.id", ondelete="SET NULL"))
    factura_id = Column(UUID(as_uuid=True), ForeignKey("facturas_b2b.id", ondelete="SET NULL"))
    pago_id = Column(UUID(as_uuid=True), ForeignKey("pagos_b2b.id", ondelete="SET NULL"))
    score = Column(Numeric(5, 4), nullable=False)
    tipo_match = Column(String, nullable=False)
    criterios = Column(JSONB, nullable=False, default=dict)
    estado = Column(String, nullable=False, default="SUGERIDO")
    requiere_revision_manual = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), server_default=text("now()"))
    updated_at = Column(DateTime(timezone=True), server_default=text("now()"))

    movimiento = relationship("MovimientoBancarioDemo")
    cliente = relationship("ClienteB2B")
    factura = relationship("FacturaB2B")


class Conciliacion(Base):
    __tablename__ = "conciliaciones"
    id = uuid_pk()
    movimiento_id = Column(UUID(as_uuid=True), ForeignKey("movimientos_bancarios_demo.id"), nullable=False)
    pago_id = Column(UUID(as_uuid=True), ForeignKey("pagos_b2b.id", ondelete="SET NULL"))
    factura_id = Column(UUID(as_uuid=True), ForeignKey("facturas_b2b.id", ondelete="SET NULL"))
    match_id = Column(UUID(as_uuid=True), ForeignKey("matches_bancarios.id", ondelete="SET NULL"))
    monto_conciliado = Column(Numeric(18, 2), nullable=False)
    metodo = Column(String, nullable=False, default="AUTOMATICO")
    estado = Column(String, nullable=False, default="PENDIENTE")
    revisado_por = Column(UUID(as_uuid=True))
    conciliado_at = Column(DateTime(timezone=True))
    observacion = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=text("now()"))
    updated_at = Column(DateTime(timezone=True), server_default=text("now()"))


class AplicacionPago(Base):
    __tablename__ = "aplicaciones_pago"
    id = uuid_pk()
    pago_id = Column(UUID(as_uuid=True), ForeignKey("pagos_b2b.id", ondelete="CASCADE"), nullable=False)
    factura_id = Column(UUID(as_uuid=True), ForeignKey("facturas_b2b.id", ondelete="CASCADE"), nullable=False)
    conciliacion_id = Column(UUID(as_uuid=True), ForeignKey("conciliaciones.id", ondelete="SET NULL"))
    monto_aplicado = Column(Numeric(18, 2), nullable=False)
    fecha_aplicacion = Column(DateTime(timezone=True), server_default=text("now()"))
    created_at = Column(DateTime(timezone=True), server_default=text("now()"))


class RebajaDocumento(Base):
    __tablename__ = "rebajas_documento"
    id = uuid_pk()
    factura_id = Column(UUID(as_uuid=True), ForeignKey("facturas_b2b.id"), nullable=False)
    pago_id = Column(UUID(as_uuid=True), ForeignKey("pagos_b2b.id"), nullable=False)
    aplicacion_pago_id = Column(UUID(as_uuid=True), ForeignKey("aplicaciones_pago.id", ondelete="SET NULL"))
    monto_rebajado = Column(Numeric(18, 2), nullable=False)
    estado = Column(String, nullable=False, default="PENDIENTE")
    procesada_at = Column(DateTime(timezone=True))
    error_detalle = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=text("now()"))
    updated_at = Column(DateTime(timezone=True), server_default=text("now()"))


class TrazaCicloIngreso(Base):
    __tablename__ = "trazas_ciclo_ingreso"
    id = uuid_pk()
    correlation_id = Column(UUID(as_uuid=True), server_default=text("gen_random_uuid()"), unique=True)
    cliente_id = Column(UUID(as_uuid=True), ForeignKey("clientes_b2b.id"), nullable=False)
    factura_id = Column(UUID(as_uuid=True), ForeignKey("facturas_b2b.id", ondelete="SET NULL"), unique=True)
    estado_general = Column(String, nullable=False, default="ACTIVA")
    iniciada_at = Column(DateTime(timezone=True), server_default=text("now()"))
    finalizada_at = Column(DateTime(timezone=True))
    metadata_ = Column("metadata", JSONB, nullable=False, default=dict)
    created_at = Column(DateTime(timezone=True), server_default=text("now()"))
    updated_at = Column(DateTime(timezone=True), server_default=text("now()"))


class AgentTask(Base):
    __tablename__ = "agent_tasks"
    id = uuid_pk()
    trace_id = Column(UUID(as_uuid=True), ForeignKey("trazas_ciclo_ingreso.id", ondelete="SET NULL"))
    tipo_tarea = Column(String, nullable=False)
    agente = Column(String, nullable=False)
    origen_tipo = Column(String)
    origen_id = Column(UUID(as_uuid=True))
    estado = Column(String, nullable=False, default="DETECTED")
    input_data = Column(JSONB, nullable=False, default=dict)
    output_data = Column(JSONB, nullable=False, default=dict)
    error_detalle = Column(Text)
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=text("now()"))
    updated_at = Column(DateTime(timezone=True), server_default=text("now()"))


class DecisionIA(Base):
    __tablename__ = "decisiones_ia"
    id = uuid_pk()
    task_id = Column(UUID(as_uuid=True), ForeignKey("agent_tasks.id", ondelete="SET NULL"))
    trace_id = Column(UUID(as_uuid=True), ForeignKey("trazas_ciclo_ingreso.id", ondelete="SET NULL"))
    agente = Column(String, nullable=False)
    tipo_decision = Column(String, nullable=False)
    decision = Column(String, nullable=False)
    confianza = Column(Numeric(5, 4))
    explicacion = Column(Text)
    modelo = Column(String)
    requiere_humano = Column(Boolean, nullable=False, default=False)
    aceptada = Column(Boolean)
    validada_por = Column(UUID(as_uuid=True))
    validada_at = Column(DateTime(timezone=True))
    metadata_ = Column("metadata", JSONB, nullable=False, default=dict)
    created_at = Column(DateTime(timezone=True), server_default=text("now()"))


class BusinessRule(Base):
    __tablename__ = "business_rules"
    id = uuid_pk()
    codigo = Column(String, nullable=False, unique=True)
    modulo = Column(String, nullable=False)
    nombre = Column(String, nullable=False)
    descripcion = Column(Text)
    tipo_valor = Column(String, nullable=False)
    valor = Column(JSONB, nullable=False)
    unidad = Column(String)
    activo = Column(Boolean, nullable=False, default=True)
    updated_by = Column(UUID(as_uuid=True))
    created_at = Column(DateTime(timezone=True), server_default=text("now()"))
    updated_at = Column(DateTime(timezone=True), server_default=text("now()"))


class AuditLog(Base):
    __tablename__ = "audit_log"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    trace_id = Column(UUID(as_uuid=True), ForeignKey("trazas_ciclo_ingreso.id", ondelete="SET NULL"))
    actor_tipo = Column(String, nullable=False)
    actor_id = Column(String)
    accion = Column(String, nullable=False)
    entidad_tipo = Column(String)
    entidad_id = Column(String)
    before_data = Column(JSONB)
    after_data = Column(JSONB)
    metadata_ = Column("metadata", JSONB, nullable=False, default=dict)
    created_at = Column(DateTime(timezone=True), server_default=text("now()"))


class MLPrediction(Base):
    __tablename__ = "ml_predictions"
    id = uuid_pk()
    cliente_id = Column(UUID(as_uuid=True), ForeignKey("clientes_b2b.id", ondelete="CASCADE"), nullable=False)
    factura_id = Column(UUID(as_uuid=True), ForeignKey("facturas_b2b.id", ondelete="SET NULL"))
    modelo_nombre = Column(String, nullable=False, default="modelo_pago_traza")
    modelo_version = Column(String)
    probabilidad_pago = Column(Numeric(6, 5), nullable=False)
    nivel_riesgo = Column(String, nullable=False)
    features = Column(JSONB, nullable=False, default=dict)
    metadata_ = Column("metadata", JSONB, nullable=False, default=dict)
    predicted_at = Column(DateTime(timezone=True), server_default=text("now()"))
    created_at = Column(DateTime(timezone=True), server_default=text("now()"))
