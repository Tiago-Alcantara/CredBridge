"""
Serviço de reconciliação defensiva.

Consulta a CorpX para verificar o estado real de uma ordem quando:
  - A ordem está em status não-terminal e nenhum webhook foi recebido
  - O usuário solicita refresh explícito via POST /v1/orders/:id/refresh
  - Pix Out retornou 207 e nenhum evento posterior chegou

Não atualiza status diretamente — delega à função apply_corpx_event
do OrdersService para garantir que as transições sejam validadas.
"""

from __future__ import annotations

import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.domain.models import PixOrder
from app.domain.status import PixOrderStatus, PixOrderType, is_terminal
from app.providers.base import PixProvider
from app.services.callback_service import enqueue_callback
from app.services.idempotency_service import find_order_by_id
from app.services.orders_service import OrdersService

logger = logging.getLogger(__name__)


async def reconcile_order(
    db: AsyncSession,
    provider: PixProvider,
    pix_order_id: str,
) -> PixOrderStatus | None:
    """
    Consulta a CorpX e atualiza o status da ordem se houver divergência.

    Retorna o status atualizado se houve mudança, None caso contrário.
    """
    order = await find_order_by_id(db, pix_order_id)
    if not order:
        raise ValueError(f"Ordem não encontrada: {pix_order_id}")

    if is_terminal(order.status):
        logger.debug(
            "Reconciliação ignorada para ordem em status terminal: order_id=%s status=%s",
            pix_order_id, order.status,
        )
        return None

    orders_service = OrdersService(db=db, provider=provider)

    if order.type == PixOrderType.DEPOSIT:
        return await _reconcile_deposit(db, provider, order, orders_service)
    elif order.type == PixOrderType.WITHDRAWAL:
        return await _reconcile_withdrawal(db, provider, order, orders_service)

    return None


async def _reconcile_deposit(
    db: AsyncSession,
    provider: PixProvider,
    order: PixOrder,
    orders_service: OrdersService,
) -> PixOrderStatus | None:
    try:
        qr_status = await provider.lookup_qr(
            account_id=settings.corpx_account_id,
            identifier=order.identifier,
        )
    except Exception as lookup_error:
        logger.warning(
            "Lookup de QR falhou durante reconciliação: order_id=%s error=%s",
            order.id, lookup_error,
        )
        return None

    # Mapeia status CorpX para evento interno
    corpx_status_to_event = {
        "paid": "qrcode.paid",
        "expired": "qrcode.expired",
        "cancelled": "qrcode.cancelled",
        "canceled": "qrcode.cancelled",
    }

    event_type = corpx_status_to_event.get(qr_status.status.lower())
    if not event_type:
        logger.debug(
            "Status CorpX QR não exige atualização: identifier=%s status=%s",
            order.identifier, qr_status.status,
        )
        return None

    event_payload = {
        "endToEndId": qr_status.end_to_end_id,
        "paidAmount": qr_status.paid_amount,
        "transactionId": qr_status.transaction_id,
        "source": "reconciliation_lookup",
    }

    new_status = await orders_service.apply_corpx_event(order, event_type, event_payload)

    if new_status:
        await enqueue_callback(db, order)
        logger.info(
            "Reconciliação de depósito: order_id=%s novo_status=%s",
            order.id, new_status,
        )

    return new_status


async def _reconcile_withdrawal(
    db: AsyncSession,
    provider: PixProvider,
    order: PixOrder,
    orders_service: OrdersService,
) -> PixOrderStatus | None:
    try:
        payment_status = await provider.lookup_payment(
            account_id=settings.corpx_account_id,
            identifier=order.identifier,
        )
    except Exception as lookup_error:
        logger.warning(
            "Lookup de pagamento falhou durante reconciliação: order_id=%s error=%s",
            order.id, lookup_error,
        )
        return None

    corpx_status_to_event = {
        "APPROVED": "pix.out.completed",
        "COMPLETED": "pix.out.completed",
        "REJECTED": "pix.out.failed",
        "FAILED": "pix.out.failed",
    }

    event_type = corpx_status_to_event.get(payment_status.status.upper())
    if not event_type:
        return None

    event_payload = {
        "endToEndId": payment_status.end_to_end_id,
        "amount": payment_status.amount,
        "source": "reconciliation_lookup",
    }

    new_status = await orders_service.apply_corpx_event(order, event_type, event_payload)

    if new_status:
        await enqueue_callback(db, order)
        logger.info(
            "Reconciliação de saque: order_id=%s novo_status=%s",
            order.id, new_status,
        )

    return new_status
