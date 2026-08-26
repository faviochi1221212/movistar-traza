"""Motor de reglas configurables (business_rules). Nunca hardcodear umbrales de negocio."""
from sqlalchemy.orm import Session

from app.models.models import BusinessRule
from app.services import audit

_DEFAULTS = {
    "CONFORMIDAD_RECORDATORIO_HORAS": 48,
    "CONFORMIDAD_SIN_RESPUESTA_HORAS": 120,
    "MATCH_AUTOMATICO_SCORE_MIN": 0.95,
    "MATCH_REVISION_MANUAL_SCORE_MIN": 0.70,
    "RIESGO_PAGO_BAJO_MIN": 0.90,
    "RIESGO_PAGO_MEDIO_MIN": 0.30,
    "MORA_CRITICA_DIAS": 60,
}


def get_regla(db: Session, codigo: str):
    """Devuelve el valor vigente de una regla. Cae a un default documentado solo si falta en DB."""
    rule = db.query(BusinessRule).filter(BusinessRule.codigo == codigo, BusinessRule.activo.is_(True)).first()
    if rule is None:
        return _DEFAULTS.get(codigo)
    val = rule.valor
    if rule.tipo_valor == "NUMBER" and isinstance(val, str):
        return float(val)
    return val


def get_reglas_modulo(db: Session, modulo: str | None = None):
    q = db.query(BusinessRule)
    if modulo:
        q = q.filter(BusinessRule.modulo == modulo)
    return q.order_by(BusinessRule.modulo, BusinessRule.codigo).all()


def update_regla(db: Session, codigo: str, nuevo_valor, usuario_id=None) -> BusinessRule:
    rule = db.query(BusinessRule).filter(BusinessRule.codigo == codigo).first()
    if rule is None:
        raise ValueError(f"Regla no encontrada: {codigo}")
    anterior = rule.valor
    rule.valor = nuevo_valor
    rule.updated_by = usuario_id
    db.flush()
    audit.log(
        db, actor_tipo="USER", actor_id=str(usuario_id) if usuario_id else None,
        accion="ACTUALIZAR_REGLA", entidad_tipo="business_rules", entidad_id=rule.id,
        before_data={"valor": anterior}, after_data={"valor": nuevo_valor},
    )
    return rule
