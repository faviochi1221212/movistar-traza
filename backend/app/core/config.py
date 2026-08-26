from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    env: str = "development"
    database_url: str

    supabase_url: str = ""
    supabase_service_role_key: str = ""

    dify_api_key: str = ""
    dify_chat_api_key: str = ""
    dify_base_url: str = "https://api.dify.ai/v1"

    ms_tenant_id: str = ""
    ms_client_id: str = ""
    ms_client_secret: str = ""
    ms_mailbox: str = ""

    ml_model_path: str = ""
    ml_features_path: str = ""
    seed_data_dir: str = ""

    frontend_url: str = "http://localhost:5173"
    # Lista adicional de origenes permitidos para CORS, separados por coma
    # (ej. "https://movistar-traza.vercel.app,https://otro-dominio.com").
    # Permite agregar dominios de produccion sin tocar codigo.
    allowed_origins: str = ""

    @property
    def cors_allowed_origins(self) -> list[str]:
        origins = {self.frontend_url}
        origins.update(o.strip() for o in self.allowed_origins.split(",") if o.strip())
        return list(origins)

    @property
    def dify_configurado(self) -> bool:
        return bool(self.dify_api_key)

    @property
    def dify_chat_configurado(self) -> bool:
        return bool(self.dify_chat_api_key)

    @property
    def outlook_configurado(self) -> bool:
        return bool(self.ms_tenant_id and self.ms_client_id and self.ms_client_secret)


@lru_cache
def get_settings() -> Settings:
    return Settings()
