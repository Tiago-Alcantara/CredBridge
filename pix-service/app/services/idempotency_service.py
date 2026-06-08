"""
Serviço de idempotência.

Garante que operações repetidas (retry de webhook, replay de callback,
chamada duplicada de API) não criem registros duplicados nem executem
efeitos colaterais múltiplas vezes.

Estratégia:
  - Para ordens: checa `external_id` e `identifier` com UNIQUE constraint no banco.
  - Para eventos: checa `event_id` com UNIQUE constraint em pix_events.
  - Para callbacks: checa `event_id` com UNIQUE constraint em outbox_callbacks.
"""

from __future__ import annotations

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models import OutboxCallback, PixEvent, PixOrder

logger = logging.getLogger(__name__)


async def find_order_by_external_id(
    db: AsyncSession,
    external_id: str,
) -> PixOrder | None:
    result = await db.execute(
        select(PixOrder).where(PixOrder.external_id == external_id)
    )
    return result.scalar_one_or_none()


async def find_order_by_identifier(
    db: AsyncSession,
    identifier: str,
) -> PixOrder | None:
    result = await db.execute(
        select(PixOrder).where(PixOrder.identifier == identifier)
    )
    return result.scalar_one_or_none()


async def find_order_by_id(
    db: AsyncSession,
    pix_order_id: str,
) -> PixOrder | None:
    result = await db.execute(
        select(PixOrder).where(PixOrder.id == pix_order_id)
    )
    return result.scalar_one_or_none()


async def event_already_processed(
    db: AsyncSession,
    event_id: str,
) -> bool:
    """Retorna True se o evento já foi persistido em pix_events."""
    result = await db.execute(
        select(PixEvent.id).where(PixEvent.event_id == event_id)
    )
    already_exists = result.scalar_one_or_none() is not None
    if already_exists:
        logger.info("Evento duplicado ignorado: event_id=%s", event_id)
    return already_exists


async def callback_already_queued(
    db: AsyncSession,
    event_id: str,
) -> bool:
    """Retorna True se o callback já foi enfileirado em outbox_callbacks."""
    result = await db.execute(
        select(OutboxCallback.id).where(OutboxCallback.event_id == event_id)
    )
    return result.scalar_one_or_none() is not None
