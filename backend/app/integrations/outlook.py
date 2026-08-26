"""Adaptador Microsoft Graph para el canal Outlook (lectura/respuesta de correos).

Sin MS_TENANT_ID/MS_CLIENT_ID/MS_CLIENT_SECRET no hay buzon real conectado:
el backend expone la misma interfaz pero /outlook/sync no encuentra credenciales
y lo reporta explicitamente en vez de fallar en silencio o inventar correos.
"""
import logging

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)

GRAPH_BASE = "https://graph.microsoft.com/v1.0"


class OutlookProvider:
    def __init__(self, tenant_id: str, client_id: str, client_secret: str, mailbox: str):
        self.tenant_id = tenant_id
        self.client_id = client_id
        self.client_secret = client_secret
        self.mailbox = mailbox
        self._token: str | None = None

    def _get_token(self) -> str:
        if self._token:
            return self._token
        url = f"https://login.microsoftonline.com/{self.tenant_id}/oauth2/v2.0/token"
        data = {
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "scope": "https://graph.microsoft.com/.default",
            "grant_type": "client_credentials",
        }
        resp = httpx.post(url, data=data, timeout=20)
        resp.raise_for_status()
        self._token = resp.json()["access_token"]
        return self._token

    def sync_messages(self, top: int = 25) -> list[dict]:
        token = self._get_token()
        url = f"{GRAPH_BASE}/users/{self.mailbox}/mailFolders/Inbox/messages"
        params = {"$top": top, "$orderby": "receivedDateTime desc"}
        resp = httpx.get(url, headers={"Authorization": f"Bearer {token}"}, params=params, timeout=30)
        resp.raise_for_status()
        return resp.json().get("value", [])

    def send_reply(self, message_id: str, comment: str) -> None:
        token = self._get_token()
        url = f"{GRAPH_BASE}/users/{self.mailbox}/messages/{message_id}/reply"
        resp = httpx.post(url, headers={"Authorization": f"Bearer {token}"}, json={"comment": comment}, timeout=20)
        resp.raise_for_status()


def get_outlook_provider() -> OutlookProvider | None:
    settings = get_settings()
    if not settings.outlook_configurado:
        return None
    return OutlookProvider(settings.ms_tenant_id, settings.ms_client_id, settings.ms_client_secret, settings.ms_mailbox)
