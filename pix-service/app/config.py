"""
Configuration for the Pix microservice.

All settings are loaded from environment variables (or .env file).
Pydantic-settings validates and coerces types at startup so that
missing required values fail fast rather than at runtime.
"""

from __future__ import annotations

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ------------------------------------------------------------------ #
    # Database
    # ------------------------------------------------------------------ #
    database_url: str = Field(
        description="PostgreSQL asyncpg URL, e.g. postgresql+asyncpg://user:pass@host/db",
    )

    # ------------------------------------------------------------------ #
    # CorpX API
    # ------------------------------------------------------------------ #
    pix_provider: str = Field(default="corpx", description="corpx | sandbox")

    corpx_env: str = Field(default="sandbox", description="sandbox | staging | production")
    corpx_api_base_url: str = Field(default="https://api.dev.corpxapi.com")
    corpx_auth_base_url: str = Field(default="https://auth.dev.corpxapi.com")
    corpx_client_id: str = Field(default="")
    corpx_client_secret: str = Field(default="")
    corpx_scope: str = Field(default="")
    corpx_tenant_id: str = Field(default="")
    corpx_account_id: str = Field(default="")
    corpx_receiver_pix_key: str = Field(
        default="",
        description="Chave Pix recebedora cadastrada na conta CorpX",
    )
    corpx_webhook_secret: str = Field(
        default="",
        description="Segredo HMAC configurado na subscription de webhook CorpX",
    )

    # ------------------------------------------------------------------ #
    # CredBridge callback
    # ------------------------------------------------------------------ #
    credbridge_api_url: str = Field(default="http://localhost:3001")
    credbridge_pix_webhook_path: str = Field(default="/v1/pix/webhooks/orders")
    credbridge_pix_webhook_secret: str = Field(
        default="",
        description="Segredo HMAC para assinar callbacks enviados à CredBridge",
    )
    credbridge_pix_service_api_key: str = Field(
        default="",
        description="API key que a CredBridge envia para autenticar chamadas ao Pix service",
    )

    # ------------------------------------------------------------------ #
    # Operational defaults
    # ------------------------------------------------------------------ #
    default_qr_expiration_seconds: int = Field(
        default=1800,
        description="Expiração padrão de QR dinâmico em segundos (30 min)",
    )
    callback_max_attempts: int = Field(
        default=5,
        description="Máximo de tentativas de callback para a CredBridge",
    )
    callback_base_delay_seconds: int = Field(
        default=30,
        description="Delay base (segundos) para backoff exponencial de callback",
    )


# Singleton instance — import this everywhere
settings = Settings()
