from sqlalchemy.orm import Session

from app.models.models import AuditLog


def log(
    db: Session,
    *,
    actor_tipo: str,
    accion: str,
    actor_id: str | None = None,
    entidad_tipo: str | None = None,
    entidad_id: str | None = None,
    before_data: dict | None = None,
    after_data: dict | None = None,
    metadata: dict | None = None,
    trace_id=None,
) -> AuditLog:
    """audit_log es append-only a nivel aplicacion: solo INSERT, nunca UPDATE/DELETE."""
    entry = AuditLog(
        trace_id=trace_id,
        actor_tipo=actor_tipo,
        actor_id=actor_id,
        accion=accion,
        entidad_tipo=entidad_tipo,
        entidad_id=str(entidad_id) if entidad_id is not None else None,
        before_data=before_data,
        after_data=after_data,
        metadata_=metadata or {},
    )
    db.add(entry)
    db.flush()
    return entry
