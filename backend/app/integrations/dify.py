"""Cliente central para las dos apps de Dify Cloud (clasificador de cobranza y asistente).

Dify entiende, FastAPI decide: este cliente solo interpreta lenguaje, nunca
escribe directamente en Supabase ni decide resultados financieros.

Nota de integracion verificada en vivo contra las apps reales del proyecto:
- La app clasificadora (DIFY_API_KEY) responde en `answer` con un JSON de texto
  {"type": ..., "amount": ..., "invoice": ..., "confidence": ...} para los tipos
  PAYMENT/PROMESA_PAGO, pero devuelve HTTP 400 "Model is not configured" para
  otras ramas del workflow (reclamos, consultas, notas de credito).
- La app asistente (DIFY_CHAT_API_KEY) devuelve siempre HTTP 400
  "Model is not configured": el modelo LLM no esta seleccionado en esa app
  dentro del panel de Dify Cloud.
Estas son limitaciones de configuracion del lado de Dify Cloud (fuera del
alcance de este backend); el cliente maneja ambos casos sin romper la demo:
si Dify falla, se marca pendiente de revision / se usa un resumen local.
"""
import json
import logging
import re

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)

TIMEOUT = 20.0


class DifyError(Exception):
    pass


class DifyClient:
    def __init__(self, base_url: str, api_key: str):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key

    def _post_chat(self, query: str, user: str, inputs: dict | None = None) -> str:
        if not self.api_key:
            raise DifyError("DIFY no configurado (falta API key)")
        url = f"{self.base_url}/chat-messages"
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        payload = {"inputs": inputs or {}, "query": query, "response_mode": "blocking", "user": user}
        last_exc: Exception | None = None
        for attempt in range(2):  # 1 intento + 1 reintento sencillo
            try:
                resp = httpx.post(url, headers=headers, json=payload, timeout=TIMEOUT)
                if resp.status_code == 200:
                    return resp.json().get("answer", "")
                last_exc = DifyError(f"Dify HTTP {resp.status_code}: {resp.text[:300]}")
            except httpx.HTTPError as exc:
                last_exc = exc
        assert last_exc is not None
        raise last_exc

    def clasificar_correo(self, cliente: str | None, asunto: str, cuerpo: str) -> dict | None:
        """Devuelve un dict con los campos que Dify pudo extraer, o None si Dify no responde."""
        query = f"Cliente: {cliente or 'desconocido'}\nAsunto: {asunto}\nCuerpo: {cuerpo}"
        try:
            answer = self._post_chat(query, user="traza-cobranzas")
        except DifyError as exc:
            logger.warning("Dify clasificador no disponible: %s", exc)
            return None
        return _parse_json_loose(answer)

    def preguntar(self, pregunta: str, contexto: str) -> str | None:
        query = f"Contexto de datos reales de TRAZA:\n{contexto}\n\nPregunta del analista: {pregunta}"
        try:
            return self._post_chat(query, user="traza-asistente")
        except DifyError as exc:
            logger.warning("Dify asistente no disponible: %s", exc)
            return None


def _parse_json_loose(text: str) -> dict | None:
    if not text:
        return None
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        return None
    try:
        return json.loads(match.group(0))
    except json.JSONDecodeError:
        return None


_TIPO_MAP = {
    "PAYMENT": "CONFIRMACION_PAGO",
    "CONFIRMACION_PAGO": "CONFIRMACION_PAGO",
    "PROMESA_PAGO": "PROMESA_PAGO",
    "PROMISE": "PROMESA_PAGO",
    "CONSULTA": "CONSULTA",
    "QUERY": "CONSULTA",
    "RECLAMO": "RECLAMO",
    "CLAIM": "RECLAMO",
    "NOTA_CREDITO": "NOTA_CREDITO",
    "CREDIT_NOTE": "NOTA_CREDITO",
}


def normalizar_clasificacion(raw: dict) -> dict:
    """Adapta el JSON real de Dify (type/amount/invoice/confidence) al esquema
    esperado por emails_cobranza (clasificacion, campos_extraidos, confianza)."""
    tipo_raw = str(raw.get("type") or raw.get("clasificacion") or "").upper()
    clasificacion = _TIPO_MAP.get(tipo_raw, "OTRO")
    campos = {}
    for key in ("amount", "invoice", "cliente", "banco", "operacion", "fecha", "resumen"):
        if raw.get(key) not in (None, ""):
            campos[key] = raw[key]
    confianza = raw.get("confidence", raw.get("confianza"))
    return {
        "clasificacion": clasificacion,
        "campos_extraidos": campos,
        "confianza": float(confianza) if confianza is not None else None,
    }


def get_dify_classifier() -> DifyClient:
    settings = get_settings()
    return DifyClient(settings.dify_base_url, settings.dify_api_key)


def get_dify_assistant() -> DifyClient:
    settings = get_settings()
    return DifyClient(settings.dify_base_url, settings.dify_chat_api_key)
