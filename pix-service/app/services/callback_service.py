"""
Serviço de callback (padrão outbox).

Responsável por:
  1. Enfileirar callbacks para a CredBridge na tabela outbox_callbacks.
  2. Enviar callbacks com assinatura HMAC e retry com backoff exponencial.
  3. Marcar callbacks como SENT ou FAILED após tentativas esgotadas.

O método `enqueue_callback` deve ser chamado na mesma transação
que altera o status da ordem (garantia de consistência).
"""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.domain.models import OutboxCallback, PixOrder
from app.domain.status import PixOrderStatus
from app.security.signatures import build_callback_headers

logger = logging.getLogger(__name__)


def _build_callback_payload(order: PixOrder, event_id: str) -> dict[str, Any]:
    """Monta o payload do callback para a CredBridge."""
    return {
        "eventId": event_id,
        "pixOrderId": order.id,
        "externalId": order.external_id,
        "identifier": order.identifier,
        "type": order.type,
        "status": order.status,
        "amount": order.amount,
        "txid": order.corpx_txid,
        "paymentId": order.corpx_payment_id,
        "transactionId": order.corpx_transaction_id,
        "endToEndId": order.end_to_end_id,
        "confirmedAt": order.confirmed_at.isoformat() if order.confirmed_at else None,
        "failedAt": order.failed_at.isoformat() if order.failed_at else None,
        "failureReason": order.failure_reason,
        "metadata": order.metadata_json,
    }


async def enqueue_callback(
    db: AsyncSession,
    order: PixOrder,
) -> OutboxCallback:
    """
    Enfileira um callback para a CredBridge associado à ordem.

    Deve ser chamado dentro da mesma transação que altera order.status.
    """
    event_id = str(uuid.uuid4())
    target_url = f"{settings.credbridge_api_url}{settings.credbridge_pix_webhook_path}"
    payload = _build_callback_payload(order, event_id)

    callback = OutboxCallback(
        event_id=event_id,
        pix_order_id=order.id,
        target_url=target_url,
        payload_json=payload,
        status="PENDING",
        attempt_count=0,
        next_attempt_at=datetime.now(timezone.utc),
    )
    db.add(callback)
    logger.info(
        "Callback enfileirado: event_id=%s order_id=%s status=%s",
        event_id, order.id, order.status,
    )
    return callback


async def send_pending_callbacks(db: AsyncSession) -> None:
    """
    Processa callbacks pendentes da tabela outbox.

    Deve ser chamado periodicamente (ex: a cada 10-30 s) por um worker
    ou endpoint de trigger interno.
    """
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(OutboxCallback)
        .where(OutboxCallback.status == "PENDING")
        .where(OutboxCallback.next_attempt_at <= now)
        .order_by(OutboxCallback.created_at)
        .limit(50)
    )
    callbacks = result.scalars().all()

    if not callbacks:
        return

    async with httpx.AsyncClient(timeout=10.0) as http_client:
        for callback in callbacks:
            await _attempt_send(db, http_client, callback)


def _to_camel_case(snake_str: str) -> str:
    components = snake_str.split("_")
    return components[0] + "".join(x.title() for x in components[1:])


def ensure_camel_case_keys(payload: dict[str, Any]) -> dict[str, Any]:
    return {_to_camel_case(k): v for k, v in payload.items()}


async def _attempt_send(
    db: AsyncSession,
    http_client: httpx.AsyncClient,
    callback: OutboxCallback,
) -> None:
    callback.attempt_count += 1
    
    # Garante compatibilidade caso existam registros antigos em snake_case no banco
    payload = ensure_camel_case_keys(callback.payload_json or {})
    
    headers = build_callback_headers(
        payload=payload,
        event_id=callback.event_id,
        secret=settings.credbridge_pix_webhook_secret,
    )
    body_json = json.dumps(payload, separators=(",", ":"), sort_keys=True)

    logger.info(
        "Enviando callback para CredBridge: event_id=%s URL=%s | Payload=%s | Headers=%s",
        callback.event_id,
        callback.target_url,
        payload,
        {k: v for k, v in headers.items() if "Signature" not in k}
    )

    try:
        response = await http_client.post(
            callback.target_url,
            content=body_json.encode(),
            headers=headers,
        )

        logger.info(
            "Resposta do callback recebida da CredBridge: event_id=%s | Status=%s | Body=%s",
            callback.event_id,
            response.status_code,
            response.text
        )

        if 200 <= response.status_code < 300:
            callback.status = "SENT"
            callback.last_error = None
            logger.info(
                "Callback enviado com sucesso: event_id=%s attempt=%d",
                callback.event_id, callback.attempt_count,
            )
        else:
            error_msg = f"HTTP {response.status_code}: {response.text[:200]}"
            _schedule_retry(callback, error_msg)

    except (httpx.ConnectError, httpx.TimeoutException) as network_error:
        logger.exception("Erro de conexão/timeout ao enviar callback")
        _schedule_retry(callback, str(network_error))


def _schedule_retry(callback: OutboxCallback, error: str) -> None:
    """Agenda próxima tentativa com backoff exponencial ou marca como FAILED."""
    callback.last_error = error

    if callback.attempt_count >= settings.callback_max_attempts:
        callback.status = "FAILED"
        logger.error(
            "Callback permanentemente falho após %d tentativas: event_id=%s error=%s",
            callback.attempt_count, callback.event_id, error,
        )
        return

    # Backoff exponencial: 30s, 60s, 120s, 240s, ...
    delay_seconds = settings.callback_base_delay_seconds * (2 ** (callback.attempt_count - 1))
    callback.next_attempt_at = datetime.now(timezone.utc) + timedelta(seconds=delay_seconds)

    logger.warning(
        "Callback falhou (tentativa %d/%d): event_id=%s error=%s próxima=%ds",
        callback.attempt_count,
        settings.callback_max_attempts,
        callback.event_id,
        error,
        delay_seconds,
    )
