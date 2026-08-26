import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api import (
    auditoria, bi, centro_control, chat, cliente360, cobranzas,
    configuracion, facturacion, outlook, recaudo,
)
from app.core.config import get_settings
from app.core.database import engine

logging.basicConfig(level=logging.INFO)
settings = get_settings()

app = FastAPI(title="TRAZA API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    # FRONTEND_URL (legacy) + ALLOWED_ORIGINS (lista separada por coma,
    # para agregar dominios de produccion -ej. Vercel- sin tocar codigo).
    allow_origins=settings.cors_allowed_origins,
    # Vite prueba puertos secuenciales (5173, 5174, ...) si el puerto por defecto
    # ya esta ocupado por otro proyecto local, asi que en desarrollo aceptamos
    # cualquier puerto de localhost/127.0.0.1 en vez de fijar uno solo.
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(facturacion.router)
app.include_router(cobranzas.router)
app.include_router(recaudo.router)
app.include_router(bi.router)
app.include_router(auditoria.router)
app.include_router(configuracion.router)
app.include_router(chat.router)
app.include_router(outlook.router)
app.include_router(cliente360.router)
app.include_router(centro_control.router)


@app.get("/")
def root():
    db_ok = True
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception:
        db_ok = False
    return {
        "status": "ok" if db_ok else "degraded",
        "database_conectada": db_ok,
        "dify_configurado": settings.dify_configurado,
        "dify_chat_configurado": settings.dify_chat_configurado,
        "outlook_configurado": settings.outlook_configurado,
    }
