from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.serialization import to_jsonable
from app.services import asistente

router = APIRouter(prefix="/api", tags=["chat"])


class ChatBody(BaseModel):
    pregunta: str


@router.post("/chat")
def chat(body: ChatBody, db: Session = Depends(get_db)):
    return to_jsonable(asistente.responder(db, body.pregunta))
