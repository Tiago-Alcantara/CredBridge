"""
Domain models (SQLAlchemy ORM).

Tables:
  - pix_orders        — ordens de depósito e saque Pix
  - pix_events        — histórico de eventos (webhooks, lookups, callbacks)
  - outbox_callbacks  — fila de callbacks para a CredBridge (padrão outbox)
  - collection_orders — cobranças futuras ao sacado vinculadas a NF-e antecipadas
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class PixOrder(Base):
    """
    Representa uma ordem Pix — depósito (QR dinâmico) ou saque (Pix Out).

    O campo `identifier` é a chave de reconciliação com a CorpX.
    Deve ser um NanoID alfanumérico de 12-15 chars com prefixo:
      - cbd_<id>  → depósito
      - cbw_<id>  → saque
    """

    __tablename__ = "pix_orders"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=_uuid
    )

    # CredBridge reference
    external_id: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    identifier: Mapped[str] = mapped_column(String(35), unique=True, nullable=False)

    # Classificação
    type: Mapped[str] = mapped_column(String(20), nullable=False)       # DEPOSIT | WITHDRAWAL
    owner_id: Mapped[str] = mapped_column(String(255), nullable=False)
    owner_role: Mapped[str] = mapped_column(String(20), nullable=False)  # pme | investor

    # Valor em centavos (inteiro) para evitar ponto flutuante em operações financeiras
    amount_cents: Mapped[int] = mapped_column(Integer, nullable=False)

    # Status interno normalizado
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="CREATED")

    # CorpX account scope
    corpx_account_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    corpx_tenant_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    corpx_pix_key: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # CorpX identifiers retornados pela API
    corpx_txid: Mapped[str | None] = mapped_column(String(255), nullable=True)
    corpx_payment_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    corpx_transaction_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    end_to_end_id: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # QR Code (depósitos)
    qr_code_payload: Mapped[str | None] = mapped_column(Text, nullable=True)
    qr_code_location: Mapped[str | None] = mapped_column(String(512), nullable=True)
    qr_code_base64: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Chave Pix destino (saques)
    pix_key: Mapped[str | None] = mapped_column(String(255), nullable=True)
    pix_key_type: Mapped[str | None] = mapped_column(String(20), nullable=True)

    description: Mapped[str | None] = mapped_column(String(512), nullable=True)
    metadata_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    # Timestamps de ciclo de vida
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    failed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    failure_reason: Mapped[str | None] = mapped_column(String(512), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    events: Mapped[list[PixEvent]] = relationship(
        "PixEvent", back_populates="pix_order", cascade="all, delete-orphan"
    )
    callbacks: Mapped[list[OutboxCallback]] = relationship(
        "OutboxCallback", back_populates="pix_order", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_pix_orders_external_id", "external_id"),
        Index("ix_pix_orders_identifier", "identifier"),
        Index("ix_pix_orders_status", "status"),
        Index("ix_pix_orders_owner_id", "owner_id"),
    )

    @property
    def amount(self) -> float:
        """Valor BRL em float com 2 casas decimais."""
        return self.amount_cents / 100


class PixEvent(Base):
    """
    Log imutável de todos os eventos que afetaram uma ordem Pix.

    Fontes possíveis: webhook CorpX, lookup defensivo, evento interno, callback CredBridge.
    """

    __tablename__ = "pix_events"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=_uuid
    )
    event_id: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    pix_order_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("pix_orders.id"), nullable=False
    )
    source: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # corpx_webhook | corpx_lookup | internal | credbridge_callback
    event_type: Mapped[str] = mapped_column(String(100), nullable=False)
    payload_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    pix_order: Mapped[PixOrder] = relationship("PixOrder", back_populates="events")

    __table_args__ = (
        Index("ix_pix_events_pix_order_id", "pix_order_id"),
        Index("ix_pix_events_event_id", "event_id"),
    )


class OutboxCallback(Base):
    """
    Fila de callbacks a serem enviados para a API CredBridge.

    Implementa o padrão Transactional Outbox: o callback é criado na mesma
    transação que altera o status da ordem, garantindo consistência.
    Um background worker (ou endpoint de retry) processa os itens PENDING.
    """

    __tablename__ = "outbox_callbacks"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=_uuid
    )
    event_id: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    pix_order_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("pix_orders.id"), nullable=False
    )
    target_url: Mapped[str] = mapped_column(String(512), nullable=False)
    payload_json: Mapped[dict] = mapped_column(JSONB, nullable=False)

    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="PENDING"
    )  # PENDING | SENT | FAILED
    attempt_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    next_attempt_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    pix_order: Mapped[PixOrder] = relationship("PixOrder", back_populates="callbacks")

    __table_args__ = (
        Index("ix_outbox_callbacks_status", "status"),
        Index("ix_outbox_callbacks_pix_order_id", "pix_order_id"),
        Index("ix_outbox_callbacks_next_attempt_at", "next_attempt_at"),
    )


class CollectionOrder(Base):
    """
    Cobrança futura ao sacado de uma NF-e antecipada.

    Criada no momento do saque da PME, com QR dinâmico imediato e expiração
    na data de vencimento da NF-e. Quando paga, aciona a liquidação on-chain.
    """

    __tablename__ = "collection_orders"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=_uuid
    )

    # Referências CredBridge
    receivable_id: Mapped[str] = mapped_column(String(255), nullable=False)
    pme_user_id: Mapped[str] = mapped_column(String(255), nullable=False)
    created_from_withdrawal_order_id: Mapped[str | None] = mapped_column(
        UUID(as_uuid=False), ForeignKey("pix_orders.id"), nullable=True
    )

    # Dados do sacado
    debtor_name: Mapped[str] = mapped_column(String(255), nullable=False)
    debtor_document: Mapped[str] = mapped_column(String(20), nullable=False)

    # Valor e datas
    amount_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    due_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    payment_deadline: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    # Status da cobrança
    status: Mapped[str] = mapped_column(
        String(30), nullable=False, default="PENDING_PAYMENT"
    )  # PENDING_PAYMENT | PAID | EXPIRED | CANCELED | FAILED

    # CorpX identifiers
    corpx_account_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    corpx_pix_key: Mapped[str | None] = mapped_column(String(255), nullable=True)
    identifier: Mapped[str] = mapped_column(String(35), unique=True, nullable=False)
    corpx_txid: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # QR Code
    qr_code_payload: Mapped[str | None] = mapped_column(Text, nullable=True)
    qr_code_location: Mapped[str | None] = mapped_column(String(512), nullable=True)
    qr_code_base64: Mapped[str | None] = mapped_column(Text, nullable=True)
    end_to_end_id: Mapped[str | None] = mapped_column(String(255), nullable=True)

    metadata_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("ix_collection_orders_receivable_id", "receivable_id"),
        Index("ix_collection_orders_identifier", "identifier"),
        Index("ix_collection_orders_status", "status"),
    )

    @property
    def amount(self) -> float:
        return self.amount_cents / 100
