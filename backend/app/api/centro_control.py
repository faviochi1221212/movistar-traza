"""Centro de Control: mirada transversal, no un duplicado de BI (seccion 28)."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.serialization import model_to_dict
from app.models.models import AuditLog, CasoCobranza, CasoFacturacion, MatchBancario
from app.services import bi, cobranzas, facturacion

router = APIRouter(prefix="/api/centro-control", tags=["centro_control"])


@router.get("/resumen")
def resumen(db: Session = Depends(get_db)):
    fact = facturacion.resumen_ciclo(db)
    cart = cobranzas.resumen_cartera(db)
    general = bi.resumen_general(db)

    casos_criticos_fact = (
        db.query(CasoFacturacion)
        .filter(CasoFacturacion.prioridad.in_(["ALTA", "CRITICA"]), CasoFacturacion.estado == "ABIERTO")
        .order_by(CasoFacturacion.created_at.desc()).limit(5).all()
    )
    casos_criticos_cob = (
        db.query(CasoCobranza)
        .filter(CasoCobranza.prioridad.in_(["ALTA", "CRITICA"]), CasoCobranza.estado == "ABIERTO")
        .order_by(CasoCobranza.created_at.desc()).limit(5).all()
    )
    matches_pendientes = (
        db.query(MatchBancario)
        .filter(MatchBancario.estado == "SUGERIDO", MatchBancario.requiere_revision_manual.is_(True))
        .order_by(MatchBancario.created_at.desc()).limit(5).all()
    )
    actividad = db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(10).all()

    casos = []
    for c in casos_criticos_fact:
        casos.append({"modulo": "Facturación", "prioridad": c.prioridad, "cliente": c.cliente.razon_social if c.cliente else None,
                       "asunto": c.asunto, "impacto": float(c.impacto_monto) if c.impacto_monto else None, "id": str(c.id)})
    for c in casos_criticos_cob:
        casos.append({"modulo": "Cobranzas", "prioridad": c.prioridad, "cliente": c.cliente.razon_social if c.cliente else None,
                       "asunto": c.descripcion, "impacto": float(c.impacto_monto) if c.impacto_monto else None, "id": str(c.id)})
    for m in matches_pendientes:
        casos.append({"modulo": "Recaudo", "prioridad": "MEDIA", "cliente": m.cliente.razon_social if m.cliente else None,
                       "asunto": "Match bancario requiere revisión manual", "impacto": None, "id": str(m.id)})

    return {
        "estado_general": {
            "facturacion": fact, "cartera_pendiente": cart["cartera_pendiente"], "cartera_vencida": cart["cartera_vencida"],
            "conciliaciones_automaticas": general["recaudo"]["conciliaciones_automaticas"],
            "conciliaciones_manuales": general["recaudo"]["conciliaciones_manuales"],
        },
        "casos_relevantes": casos[:10],
        "actividad_reciente": [model_to_dict(a) for a in actividad],
    }
