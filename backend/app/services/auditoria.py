from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models.models import AuditLog, TrazaCicloIngreso


def listar_eventos(db: Session, limit: int = 100, offset: int = 0, entidad_tipo: str | None = None):
    q = db.query(AuditLog).order_by(AuditLog.created_at.desc())
    if entidad_tipo:
        q = q.filter(AuditLog.entidad_tipo == entidad_tipo)
    return q.offset(offset).limit(limit).all()


def resumen(db: Session) -> dict:
    total = db.query(AuditLog).count()
    acciones_ia = db.query(AuditLog).filter(AuditLog.actor_tipo == "AGENT").count()
    revisiones_pendientes = db.execute(text(
        "SELECT COUNT(*) FROM public.casos_facturacion WHERE estado IN ('ABIERTO','EN_REVISION') "
        "UNION ALL SELECT COUNT(*) FROM public.casos_cobranza WHERE estado IN ('ABIERTO','EN_REVISION') "
        "UNION ALL SELECT COUNT(*) FROM public.matches_bancarios WHERE estado='SUGERIDO' AND requiere_revision_manual"
    )).scalars().all()
    alertas_criticas = db.execute(text(
        "SELECT COUNT(*) FROM public.casos_facturacion WHERE prioridad='CRITICA' AND estado='ABIERTO' "
        "UNION ALL SELECT COUNT(*) FROM public.casos_cobranza WHERE prioridad='CRITICA' AND estado='ABIERTO'"
    )).scalars().all()
    return {
        "eventos_registrados": total,
        "acciones_ia_ejecutadas": acciones_ia,
        "revisiones_pendientes": sum(revisiones_pendientes),
        "alertas_criticas": sum(alertas_criticas),
    }


def reconstruir_traza(db: Session, trace_id) -> dict | None:
    traza = db.query(TrazaCicloIngreso).get(trace_id)
    if not traza:
        return None
    eventos = db.query(AuditLog).filter(AuditLog.trace_id == trace_id).order_by(AuditLog.created_at.asc()).all()
    tareas = db.execute(text(
        "SELECT tipo_tarea, agente, estado, created_at FROM public.agent_tasks WHERE trace_id=:tid ORDER BY created_at"
    ), {"tid": str(trace_id)}).mappings().all()
    decisiones = db.execute(text(
        "SELECT tipo_decision, decision, confianza, requiere_humano, created_at FROM public.decisiones_ia WHERE trace_id=:tid ORDER BY created_at"
    ), {"tid": str(trace_id)}).mappings().all()
    return {
        "traza": {
            "id": str(traza.id), "correlation_id": str(traza.correlation_id),
            "cliente_id": str(traza.cliente_id), "factura_id": str(traza.factura_id) if traza.factura_id else None,
            "estado_general": traza.estado_general,
        },
        "eventos": [
            {"accion": e.accion, "actor_tipo": e.actor_tipo, "entidad_tipo": e.entidad_tipo,
             "entidad_id": e.entidad_id, "created_at": e.created_at.isoformat()} for e in eventos
        ],
        "tareas": [dict(t) for t in tareas],
        "decisiones": [dict(d) for d in decisiones],
    }
