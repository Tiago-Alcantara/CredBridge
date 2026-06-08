"""
Router de webhooks CorpX.

Recebe eventos CorpX, valida assinatura HMAC, persiste eventos
e aciona atualização de status + enfileiramento de callback CredBridge.

Retorna 200 rapidamente para não causar timeout no retry da CorpX.
Processamento é feito de forma síncrona mas eficiente dentro do handler.
"""

from __future__ import annotations

import logging
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.domain.models import CollectionOrder, PixEvent, PixOrder
from app.domain.schemas import CorpXWebhookPayload
from app.domain.status import PixOrderStatus
from app.providers.base import PixProvider
from app.providers.corpx import CorpXClient
from app.providers.sandbox import SandboxPixProvider
from app.security.hmac import verify_corpx_hmac_signature
from app.services.callback_service import enqueue_callback
from app.services.idempotency_service import (
    event_already_processed,
    find_order_by_identifier,
)
from app.services.orders_service import OrdersService
from sqlalchemy import select

router = APIRouter(prefix="/v1/webhooks", tags=["webhooks"])

logger = logging.getLogger(__name__)


def _get_provider() -> PixProvider:
    if settings.pix_provider == "sandbox":
        return SandboxPixProvider()
    return CorpXClient()


@router.post(
    "/corpx",
    status_code=status.HTTP_200_OK,
    summary="Receber webhook da CorpX",
)
async def receive_corpx_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """
    Endpoint que recebe todos os eventos da CorpX.

    Fluxo:
      1. Valida assinatura HMAC
      2. Parseia evento
      3. Verifica idempotência (event_id já processado?)
      4. Encontra a ordem local pelo identifier/txid/paymentId do payload
      5. Persiste evento em pix_events
      6. Atualiza status da ordem
      7. Enfileira callback para a CredBridge
    """
    raw_body = await request.body()
    
    # Log de cabeçalhos e body para depuração total do fluxo
    logger.info("Webhook CorpX recebido. Headers: %s", dict(request.headers))
    logger.info("Webhook CorpX Body: %s", raw_body.decode("utf-8", errors="replace"))

    signature_header = request.headers.get("X-CorpX-Signature") or request.headers.get("X-Signature")

    if not verify_corpx_hmac_signature(raw_body, signature_header, settings.corpx_webhook_secret):
        logger.warning(
            "Validação HMAC do webhook CorpX falhou. signature_header=%s, webhook_secret_configured=%s",
            signature_header,
            bool(settings.corpx_webhook_secret),
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Assinatura HMAC inválida",
        )

    try:
        body_dict = await request.json()
        webhook = CorpXWebhookPayload(**body_dict)
    except Exception as parse_error:
        logger.warning("Falha ao parsear webhook CorpX: %s", parse_error)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payload de webhook inválido",
        ) from parse_error

    # Filtra o webhook pelo account_id se estiver configurado, ignorando eventos de outras contas
    payload_account_id = (
        body_dict.get("accountId")
        or body_dict.get("account_id")
        or webhook.data.get("accountId")
        or webhook.data.get("account_id")
    )
    if settings.corpx_account_id and payload_account_id:
        if str(payload_account_id).strip() != str(settings.corpx_account_id).strip():
            logger.info(
                "Ignorando webhook de outra conta CorpX: webhook_account=%s, configurado=%s",
                payload_account_id,
                settings.corpx_account_id,
            )
            return {"status": "ignored_other_account"}

    event_id = webhook.event_id or str(uuid.uuid4())

    if await event_already_processed(db, event_id):
        return {"status": "already_processed"}

    await _process_webhook_event(db, event_id, webhook.event_type, webhook.data, body_dict)

    return {"status": "ok"}


async def _process_webhook_event(
    db: AsyncSession,
    event_id: str,
    event_type: str,
    data: dict[str, Any],
    raw_payload: dict[str, Any],
) -> None:
    """
    Processa o evento CorpX após validação e deduplicação.

    Tenta encontrar a ordem correspondente usando o identifier, txid
    ou paymentId presentes no payload. Se não encontrar, persiste o
    evento órfão para auditoria e segue.
    """
    identifier = (
        data.get("identifier")
        or data.get("qrCode", {}).get("identifier")
        or raw_payload.get("identifier")
    )
    txid = data.get("txid") or data.get("qrCode", {}).get("txid")
    payment_id = data.get("paymentId")

    order = await _find_order_for_event(db, identifier, txid, payment_id)

    if order is None:
        # Evento pode ser para uma collection_order — verificar
        collection = await _find_collection_for_event(db, identifier)
        if collection:
            await _process_collection_event(db, collection, event_id, event_type, data)
            return

        # Evento órfão — persiste para auditoria sem associar a uma ordem
        logger.warning(
            "Evento CorpX sem ordem correspondente: event_type=%s identifier=%s txid=%s payment_id=%s",
            event_type, identifier, txid, payment_id,
        )
        orphan_event = PixEvent(
            event_id=event_id,
            pix_order_id="00000000-0000-0000-0000-000000000000",  # placeholder
            source="corpx_webhook",
            event_type=event_type,
            payload_json={**raw_payload, "_orphan": True},
        )
        # Não adiciona ao DB sem uma ordem válida — loga e retorna
        return

    # Persiste o evento de auditoria
    pix_event = PixEvent(
        event_id=event_id,
        pix_order_id=order.id,
        source="corpx_webhook",
        event_type=event_type,
        payload_json=raw_payload,
    )
    db.add(pix_event)

    # Aplica a transição de status
    orders_service = OrdersService(db=db, provider=_get_provider())
    new_status = await orders_service.apply_corpx_event(order, event_type, data)

    # Enfileira callback para a CredBridge se houve mudança de status relevante
    if new_status and new_status in {
        PixOrderStatus.CONFIRMED,
        PixOrderStatus.FAILED,
        PixOrderStatus.EXPIRED,
        PixOrderStatus.CANCELED,
        PixOrderStatus.TIMEOUT,
        PixOrderStatus.REFUNDED,
    }:
        await enqueue_callback(db, order)


async def _find_order_for_event(
    db: AsyncSession,
    identifier: str | None,
    txid: str | None,
    payment_id: str | None,
) -> PixOrder | None:
    """Busca a ordem usando identifier, txid ou payment_id."""
    if identifier:
        order = await find_order_by_identifier(db, identifier)
        if order:
            return order

    if txid:
        result = await db.execute(
            select(PixOrder).where(PixOrder.corpx_txid == txid)
        )
        order = result.scalar_one_or_none()
        if order:
            return order

    if payment_id:
        result = await db.execute(
            select(PixOrder).where(PixOrder.corpx_payment_id == payment_id)
        )
        return result.scalar_one_or_none()

    return None


async def _find_collection_for_event(
    db: AsyncSession,
    identifier: str | None,
) -> CollectionOrder | None:
    if not identifier:
        return None
    result = await db.execute(
        select(CollectionOrder).where(CollectionOrder.identifier == identifier)
    )
    return result.scalar_one_or_none()


async def _process_collection_event(
    db: AsyncSession,
    collection: CollectionOrder,
    event_id: str,
    event_type: str,
    data: dict[str, Any],
) -> None:
    """
    Processa evento de pagamento de cobrança futura.

    Quando paga, cria um callback especial para a CredBridge liquidar
    o recebível on-chain.
    """
    from datetime import datetime, timezone

    if event_type in ("qrcode.paid", "pix.in.completed"):
        collection.status = "PAID"
        collection.paid_at = datetime.now(timezone.utc)
        collection.end_to_end_id = data.get("endToEndId")

        # Callback especial de liquidação de cobrança
        callback_event_id = str(uuid.uuid4())
        from app.domain.models import OutboxCallback
        callback = OutboxCallback(
            event_id=callback_event_id,
            pix_order_id=collection.created_from_withdrawal_order_id or collection.id,
            target_url=f"{settings.credbridge_api_url}{settings.credbridge_pix_webhook_path}",
            payload_json={
                "eventId": callback_event_id,
                "type": "COLLECTION",
                "collectionOrderId": collection.id,
                "receivableId": collection.receivable_id,
                "identifier": collection.identifier,
                "status": "PAID",
                "amount": collection.amount,
                "endToEndId": collection.end_to_end_id,
                "paidAt": collection.paid_at.isoformat() if collection.paid_at else None,
            },
            status="PENDING",
            attempt_count=0,
        )
        db.add(callback)
        logger.info(
            "Cobrança futura paga — callback de liquidação enfileirado: collection_id=%s",
            collection.id,
        )

    elif event_type in ("qrcode.expired", "qrcode.cancelled"):
        collection.status = "EXPIRED" if "expired" in event_type else "CANCELED"
