"""Orquestador: unico punto que crea/avanza agent_tasks y trazas_ciclo_ingreso.

No es un LLM ni un microservicio (seccion 19): es una capa de FastAPI que
recibe eventos, decide el agente responsable y deja constancia auditable
del ciclo DETECTED -> ... -> VERIFIED.
"""
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.models import AgentTask, TrazaCicloIngreso
from app.services import audit

AGENTES_VALIDOS = {"ORQUESTADOR", "FACTURACION", "COBRANZAS", "BI"}


def get_or_create_traza(db: Session, cliente_id, factura_id=None) -> TrazaCicloIngreso:
    traza = None
    if factura_id:
        traza = db.query(TrazaCicloIngreso).filter(TrazaCicloIngreso.factura_id == factura_id).first()
    if not traza:
        traza = TrazaCicloIngreso(cliente_id=cliente_id, factura_id=factura_id, estado_general="ACTIVA")
        db.add(traza)
        db.flush()
    return traza


def crear_tarea(db: Session, *, tipo_tarea: str, agente: str, origen_tipo: str | None = None,
                 origen_id=None, cliente_id=None, factura_id=None, input_data: dict | None = None) -> AgentTask:
    assert agente in AGENTES_VALIDOS, f"Agente invalido: {agente}"
    traza = get_or_create_traza(db, cliente_id, factura_id) if cliente_id else None
    task = AgentTask(
        trace_id=traza.id if traza else None, tipo_tarea=tipo_tarea, agente=agente,
        origen_tipo=origen_tipo, origen_id=origen_id, estado="DETECTED",
        input_data=input_data or {}, started_at=datetime.now(timezone.utc),
    )
    db.add(task)
    db.flush()
    audit.log(db, actor_tipo="AGENT", actor_id=agente, accion=f"TASK_DETECTED:{tipo_tarea}",
               entidad_tipo="agent_tasks", entidad_id=task.id, trace_id=task.trace_id)
    return task


def avanzar_tarea(db: Session, task: AgentTask, estado: str, *, output_data: dict | None = None, error: str | None = None) -> AgentTask:
    task.estado = estado
    if output_data:
        task.output_data = {**(task.output_data or {}), **output_data}
    if error:
        task.error_detalle = error
    if estado in ("EXECUTED", "VERIFIED", "FAILED", "CANCELLED"):
        task.completed_at = datetime.now(timezone.utc)
    db.flush()
    audit.log(db, actor_tipo="AGENT", actor_id=task.agente, accion=f"TASK_{estado}",
               entidad_tipo="agent_tasks", entidad_id=task.id, trace_id=task.trace_id, after_data=output_data)
    return task
