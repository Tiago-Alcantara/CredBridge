"""
Pydantic schemas (request/response) do microserviço Pix.

Separados dos modelos SQLAlchemy para manter a camada de persistência
desacoplada da camada de API.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, field_validator, AliasChoices

from app.domain.money import brl_to_cents, validate_brl_amount
from app.domain.status import CollectionOrderStatus, OwnerRole, PixOrderStatus, PixOrderType


# ─────────────────────────────────────────── #
# Schemas de entrada (requests)
# ─────────────────────────────────────────── #


class CreateDepositOrderRequest(BaseModel):
    external_id: str = Field(
        description="ID da Transaction CredBridge — usado como chave de idempotência",
        max_length=255,
    )
    owner_id: str = Field(description="ID do usuário CredBridge", max_length=255)
    owner_role: OwnerRole = Field(description="Papel do dono: pme | investor")
    amount: float = Field(description="Valor BRL com no máximo 2 casas decimais", gt=0)
    description: str | None = Field(default=None, max_length=512)
    expires_in_seconds: int = Field(
        default=1800,
        ge=60,
        le=86400,
        description="Tempo de expiração do QR em segundos",
    )
    payer_tax_number: str | None = Field(
        default=None,
        description="CPF/CNPJ do pagador para restrição (não usado no MVP)",
    )
    metadata: dict[str, Any] | None = Field(default=None)

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, value: float) -> float:
        validate_brl_amount(value)
        return value


class CreateWithdrawalOrderRequest(BaseModel):
    external_id: str = Field(max_length=255)
    owner_id: str = Field(max_length=255)
    owner_role: OwnerRole
    amount: float = Field(gt=0)
    pix_key: str = Field(max_length=255)
    pix_key_type: str = Field(
        description="CPF | CNPJ | EMAIL | PHONE | EVP",
        pattern=r"^(CPF|CNPJ|EMAIL|PHONE|EVP)$",
    )
    description: str | None = Field(default=None, max_length=512)
    metadata: dict[str, Any] | None = Field(default=None)

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, value: float) -> float:
        validate_brl_amount(value)
        return value


class CreateCollectionOrderRequest(BaseModel):
    receivable_id: str = Field(max_length=255)
    pme_user_id: str = Field(max_length=255)
    debtor_name: str = Field(max_length=255)
    debtor_document: str = Field(max_length=20)
    amount: float = Field(gt=0)
    due_date: datetime = Field(description="Data de vencimento da NF-e (ISO 8601)")
    payment_deadline: datetime
    metadata: dict[str, Any] | None = Field(default=None)

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, value: float) -> float:
        validate_brl_amount(value)
        return value


# ─────────────────────────────────────────── #
# Schemas de saída (responses)
# ─────────────────────────────────────────── #


class PixOrderResponse(BaseModel):
    pix_order_id: str
    external_id: str
    identifier: str
    type: PixOrderType
    owner_id: str
    owner_role: str
    amount: float
    status: PixOrderStatus
    corpx_txid: str | None
    corpx_payment_id: str | None
    end_to_end_id: str | None
    qr_code_payload: str | None
    qr_code_location: str | None
    qr_code_base64: str | None = None
    pix_key: str | None
    pix_key_type: str | None
    description: str | None
    failure_reason: str | None
    expires_at: datetime | None
    confirmed_at: datetime | None
    failed_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CollectionOrderResponse(BaseModel):
    collection_order_id: str
    receivable_id: str
    identifier: str
    amount: float
    status: CollectionOrderStatus
    debtor_name: str
    debtor_document: str
    due_date: datetime
    qr_code_payload: str | None
    qr_code_location: str | None
    qr_code_base64: str | None = None
    end_to_end_id: str | None
    created_at: datetime
    paid_at: datetime | None

    model_config = {"from_attributes": True}


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str


# ─────────────────────────────────────────── #
# Schema do callback para a CredBridge
# ─────────────────────────────────────────── #


class PixCallbackPayload(BaseModel):
    """Payload enviado pelo microserviço para a CredBridge via outbox."""

    eventId: str
    pixOrderId: str
    externalId: str
    identifier: str
    type: str                   # DEPOSIT | WITHDRAWAL | COLLECTION
    status: str
    amount: float
    txid: str | None
    paymentId: str | None
    transactionId: str | None
    endToEndId: str | None
    confirmedAt: datetime | None
    failedAt: datetime | None
    failureReason: str | None
    metadata: dict[str, Any] | None


# ─────────────────────────────────────────── #
# Schema do webhook CorpX recebido
# ─────────────────────────────────────────── #


class CorpXWebhookPayload(BaseModel):
    """
    Estrutura genérica do evento webhook CorpX.

    O payload completo é persistido em pix_events para auditoria;
    este schema extrai apenas os campos necessários para roteamento.
    """

    event_id: str | None = Field(
        default=None,
        validation_alias=AliasChoices("eventId", "event_id", "id"),
    )
    event_type: str = Field(
        validation_alias=AliasChoices("eventType", "event_type", "type"),
    )
    data: dict[str, Any] = Field(default_factory=dict)

    model_config = {"populate_by_name": True}
