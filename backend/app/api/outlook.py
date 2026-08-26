from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core import orchestrator
from app.core.config import get_settings
from app.core.database import get_db
from app.integrations.outlook import get_outlook_provider
from app.models.models import EmailCobranza
from app.services import audit

router = APIRouter(prefix="/api/outlook", tags=["outlook"])


@router.post("/sync")
def sync(db: Session = Depends(get_db)):
    provider = get_outlook_provider()
    if provider is None:
        return {
            "sincronizado": False,
            "motivo": "Outlook no configurado (faltan MS_TENANT_ID/MS_CLIENT_ID/MS_CLIENT_SECRET/MS_MAILBOX en backend/.env).",
            "correos_nuevos": 0,
        }
    mensajes = provider.sync_messages()
    nuevos = 0
    for m in mensajes:
        if db.query(EmailCobranza).filter(EmailCobranza.outlook_message_id == m["id"]).first():
            continue
        email = EmailCobranza(
            outlook_message_id=m["id"], outlook_thread_id=m.get("conversationId"),
            remitente=m.get("from", {}).get("emailAddress", {}).get("address", ""),
            asunto=m.get("subject"), cuerpo=m.get("bodyPreview"),
            recibido_at=m.get("receivedDateTime"),
        )
        db.add(email)
        nuevos += 1
    db.commit()
    audit.log(db, actor_tipo="SYSTEM", accion="SYNC_OUTLOOK", metadata={"correos_nuevos": nuevos})
    db.commit()
    return {"sincronizado": True, "correos_nuevos": nuevos}


class ReplyBody(BaseModel):
    comentario: str


@router.post("/messages/{message_id}/reply")
def reply(message_id: str, body: ReplyBody, db: Session = Depends(get_db)):
    provider = get_outlook_provider()
    if provider is None:
        raise HTTPException(503, "Outlook no configurado en este entorno")
    provider.send_reply(message_id, body.comentario)

    # El endpoint solo tenia el ID crudo de Outlook; se busca el registro
    # propio para poder derivar un trace_id real (cliente/factura), en vez
    # de dejarlo siempre vacio. Si el correo nunca se sincronizo a nuestra
    # base (o no tiene cliente resuelto), no hay traza logica posible.
    email = db.query(EmailCobranza).filter(EmailCobranza.outlook_message_id == message_id).first()
    traza_id = orchestrator.get_or_create_traza(db, email.cliente_id, email.factura_id).id if email and email.cliente_id else None

    audit.log(db, actor_tipo="USER", accion="RESPONDER_CORREO_OUTLOOK", entidad_tipo="emails_cobranza",
               entidad_id=message_id, trace_id=traza_id)
    db.commit()
    return {"enviado": True}
