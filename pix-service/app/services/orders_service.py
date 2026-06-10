"""
Serviço de ordens Pix.

Orquestra a criação de depósitos e saques:
  - Chama o provider CorpX
  - Persiste a ordem no banco
  - Registra eventos de auditoria

Não tem lógica de negócio de token (BRLT, Soroban) — isso é responsabilidade
exclusiva da CredBridge.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone

from nanoid import generate as nanoid_generate
from sqlalchemy.ext.asyncio import AsyncSession
import base64
import io
import segno

def generate_qr_base64(payload: str) -> str:
    """Gera o QR code em formato PNG e codifica em base64."""
    qr = segno.make_qr(payload)
    buffered = io.BytesIO()
    qr.save(buffered, kind="png", scale=5)
    return base64.b64encode(buffered.getvalue()).decode("utf-8")

from app.config import settings
from app.domain.models import CollectionOrder, PixEvent, PixOrder
from app.domain.money import brl_to_cents, cents_to_brl
from app.domain.schemas import (
    CollectionOrderResponse,
    CreateCollectionOrderRequest,
    CreateDepositOrderRequest,
    CreateWithdrawalOrderRequest,
    PixOrderResponse,
)
from app.domain.status import (
    CORPX_EVENT_TO_STATUS,
    PixOrderStatus,
    PixOrderType,
    is_transition_allowed,
    is_terminal,
)
from app.providers.base import PixProvider
from app.services.idempotency_service import (
    find_order_by_external_id,
    find_order_by_identifier,
    find_order_by_id,
)

logger = logging.getLogger(__name__)

# Prefixos de identifier para distinguir tipo de ordem na reconciliação
DEPOSIT_IDENTIFIER_PREFIX = "cbd"
WITHDRAWAL_IDENTIFIER_PREFIX = "cbw"
COLLECTION_IDENTIFIER_PREFIX = "col"


def _generate_identifier(prefix: str) -> str:
    """Gera NanoID alfanumérico com prefixo, respeitando limite de 35 chars da CorpX."""
    # prefix (3) + underscore (1) + nanoid (12) = 16 chars, bem dentro do limite
    nid = nanoid_generate(size=12)
    return f"{prefix}_{nid}"


def _build_order_response(order: PixOrder) -> PixOrderResponse:
    return PixOrderResponse(
        pix_order_id=order.id,
        external_id=order.external_id,
        identifier=order.identifier,
        type=PixOrderType(order.type),
        owner_id=order.owner_id,
        owner_role=order.owner_role,
        amount=order.amount,
        status=PixOrderStatus(order.status),
        corpx_txid=order.corpx_txid,
        corpx_payment_id=order.corpx_payment_id,
        end_to_end_id=order.end_to_end_id,
        qr_code_payload=order.qr_code_payload,
        qr_code_location=order.qr_code_location,
        qr_code_base64=order.qr_code_base64,
        pix_key=order.pix_key,
        pix_key_type=order.pix_key_type,
        description=order.description,
        failure_reason=order.failure_reason,
        expires_at=order.expires_at,
        confirmed_at=order.confirmed_at,
        failed_at=order.failed_at,
        created_at=order.created_at,
        updated_at=order.updated_at,
    )


class OrdersService:
    def __init__(self, db: AsyncSession, provider: PixProvider) -> None:
        self._db = db
        self._provider = provider

    # ------------------------------------------------------------------ #
    # Depósito
    # ------------------------------------------------------------------ #

    async def create_deposit(self, request: CreateDepositOrderRequest) -> PixOrderResponse:
        # Idempotência: se já existe uma ordem para esse external_id, retorna ela
        existing = await find_order_by_external_id(self._db, request.external_id)
        if existing:
            logger.info(
                "Depósito já existe para external_id=%s — retornando ordem existente",
                request.external_id,
            )
            return _build_order_response(existing)

        identifier = _generate_identifier(DEPOSIT_IDENTIFIER_PREFIX)
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=request.expires_in_seconds)
        amount_cents = brl_to_cents(request.amount)

        # Cria QR Code na CorpX
        qr_result = await self._provider.create_dynamic_qr(
            account_id=settings.corpx_account_id,
            pix_key=settings.corpx_receiver_pix_key,
            amount=request.amount,
            expiration_date=expires_at,
            identifier=identifier,
            message=request.description or "Aporte CredBridge",
        )

        qr_code_base64 = None
        if qr_result.payload:
            try:
                qr_code_base64 = generate_qr_base64(qr_result.payload)
            except Exception as qr_err:
                logger.error("Falha ao gerar QR Code base64 localmente: %s", qr_err)

        order = PixOrder(
            external_id=request.external_id,
            identifier=identifier,
            type=PixOrderType.DEPOSIT,
            owner_id=request.owner_id,
            owner_role=request.owner_role,
            amount_cents=amount_cents,
            status=PixOrderStatus.PENDING_PAYMENT,
            corpx_account_id=settings.corpx_account_id,
            corpx_tenant_id=settings.corpx_tenant_id,
            corpx_pix_key=settings.corpx_receiver_pix_key,
            corpx_txid=qr_result.txid,
            description=request.description,
            metadata_json=request.metadata,
            qr_code_payload=qr_result.payload,
            qr_code_location=qr_result.location,
            qr_code_base64=qr_code_base64,
            expires_at=expires_at,
        )
        self._db.add(order)
        await self._db.flush()  # gera order.id sem commit

        event = PixEvent(
            event_id=f"internal-created-{order.id}",
            pix_order_id=order.id,
            source="internal",
            event_type="deposit.qr_created",
            payload_json={
                "identifier": identifier,
                "txid": qr_result.txid,
                "amount": request.amount,
            },
        )
        self._db.add(event)

        logger.info(
            "Ordem de depósito criada: order_id=%s identifier=%s amount=%.2f",
            order.id, identifier, request.amount,
        )
        return _build_order_response(order)

    # ------------------------------------------------------------------ #
    # Saque
    # ------------------------------------------------------------------ #

    async def create_withdrawal(
        self, request: CreateWithdrawalOrderRequest
    ) -> PixOrderResponse:
        existing = await find_order_by_external_id(self._db, request.external_id)
        if existing:
            logger.info(
                "Saque já existe para external_id=%s — retornando ordem existente",
                request.external_id,
            )
            return _build_order_response(existing)

        identifier = _generate_identifier(WITHDRAWAL_IDENTIFIER_PREFIX)
        amount_cents = brl_to_cents(request.amount)

        # Lookup DICT antes de criar Pix Out (validação da chave)
        try:
            dict_info = await self._provider.dict_lookup(
                account_id=settings.corpx_account_id,
                pix_key=request.pix_key,
                key_type=request.pix_key_type,
            )
            logger.info(
                "DICT lookup OK: key=%s owner=%s", request.pix_key, dict_info.owner_name
            )
        except ValueError as dict_error:
            raise ValueError(f"Chave Pix inválida ou não encontrada: {dict_error}") from dict_error

        # Cria Pix Out async
        pix_out_result = await self._provider.create_pix_out_async(
            account_id=settings.corpx_account_id,
            key_type=request.pix_key_type,
            key=request.pix_key,
            amount=request.amount,
            identifier=identifier,
            description=request.description or "Saque CredBridge",
            metadata=request.metadata,
        )

        order = PixOrder(
            external_id=request.external_id,
            identifier=identifier,
            type=PixOrderType.WITHDRAWAL,
            owner_id=request.owner_id,
            owner_role=request.owner_role,
            amount_cents=amount_cents,
            status=PixOrderStatus.PROCESSING,
            corpx_account_id=settings.corpx_account_id,
            corpx_tenant_id=settings.corpx_tenant_id,
            corpx_payment_id=pix_out_result.payment_id,
            pix_key=request.pix_key,
            pix_key_type=request.pix_key_type,
            description=request.description,
            metadata_json=request.metadata,
        )
        self._db.add(order)
        await self._db.flush()

        event = PixEvent(
            event_id=f"internal-created-{order.id}",
            pix_order_id=order.id,
            source="internal",
            event_type="withdrawal.pix_out_created",
            payload_json={
                "identifier": identifier,
                "payment_id": pix_out_result.payment_id,
                "status": pix_out_result.status,
                "amount": request.amount,
            },
        )
        self._db.add(event)

        logger.info(
            "Ordem de saque criada: order_id=%s identifier=%s payment_id=%s",
            order.id, identifier, pix_out_result.payment_id,
        )
        return _build_order_response(order)

    # ------------------------------------------------------------------ #
    # Consultas
    # ------------------------------------------------------------------ #

    async def get_order_by_id(self, pix_order_id: str) -> PixOrderResponse:
        order = await find_order_by_id(self._db, pix_order_id)
        if not order:
            raise ValueError(f"Ordem Pix não encontrada: {pix_order_id}")
        return _build_order_response(order)

    async def get_order_by_external_id(self, external_id: str) -> PixOrderResponse:
        order = await find_order_by_external_id(self._db, external_id)
        if not order:
            raise ValueError(f"Ordem Pix não encontrada para external_id: {external_id}")
        return _build_order_response(order)

    # ------------------------------------------------------------------ #
    # Cancelamento
    # ------------------------------------------------------------------ #

    async def cancel_order(self, pix_order_id: str) -> PixOrderResponse:
        order = await find_order_by_id(self._db, pix_order_id)
        if not order:
            raise ValueError(f"Ordem Pix não encontrada: {pix_order_id}")

        if is_terminal(order.status):
            raise ValueError(
                f"Ordem em status terminal '{order.status}' não pode ser cancelada"
            )

        if order.type == PixOrderType.DEPOSIT:
            await self._provider.cancel_qr(
                account_id=settings.corpx_account_id,
                identifier=order.identifier,
            )

        order.status = PixOrderStatus.CANCELED
        event = PixEvent(
            event_id=f"internal-cancel-{pix_order_id}",
            pix_order_id=pix_order_id,
            source="internal",
            event_type="order.canceled",
            payload_json={"canceled_by": "credbridge_api"},
        )
        self._db.add(event)

        logger.info("Ordem cancelada: order_id=%s", pix_order_id)
        return _build_order_response(order)

    # ------------------------------------------------------------------ #
    # Atualização de status via evento CorpX
    # ------------------------------------------------------------------ #

    async def apply_corpx_event(
        self,
        order: PixOrder,
        event_type: str,
        event_payload: dict,
    ) -> PixOrderStatus | None:
        """
        Aplica um evento CorpX à ordem e atualiza status se a transição for válida.

        Retorna o novo status se houve mudança, None se o evento foi ignorado.
        """
        new_status = CORPX_EVENT_TO_STATUS.get(event_type)
        if not new_status:
            logger.debug("Evento CorpX sem mapeamento de status: %s", event_type)
            return None

        current_status = PixOrderStatus(order.status)

        if not is_transition_allowed(current_status, new_status):
            logger.warning(
                "Transição de status inválida para order_id=%s: %s -> %s (evento=%s)",
                order.id, current_status, new_status, event_type,
            )
            return None

        now = datetime.now(timezone.utc)
        order.status = new_status

        if new_status == PixOrderStatus.CONFIRMED:
            order.confirmed_at = now
            order.end_to_end_id = (
                event_payload.get("endToEndId")
                or event_payload.get("end_to_end_id")
                or order.end_to_end_id
            )
            paid_amount = event_payload.get("paidAmount") or event_payload.get("amount")
            if paid_amount:
                expected = order.amount
                if abs(float(paid_amount) - expected) > 0.01:
                    logger.warning(
                        "Divergência de valor: esperado=%.2f recebido=%.2f order_id=%s",
                        expected, float(paid_amount), order.id,
                    )

        elif new_status in (PixOrderStatus.FAILED, PixOrderStatus.TIMEOUT):
            order.failed_at = now
            order.failure_reason = (
                event_payload.get("reason")
                or event_payload.get("rejectReason")
                or event_type
            )

        logger.info(
            "Status atualizado: order_id=%s %s -> %s (evento=%s)",
            order.id, current_status, new_status, event_type,
        )
        return new_status

    # ------------------------------------------------------------------ #
    # Cobrança futura (collection orders)
    # ------------------------------------------------------------------ #

    async def create_collection(
        self, request: CreateCollectionOrderRequest
    ) -> CollectionOrderResponse:
        identifier = _generate_identifier(COLLECTION_IDENTIFIER_PREFIX)
        amount_cents = brl_to_cents(request.amount)

        # Gera QR dinâmico imediatamente sem expiração
        qr_result = await self._provider.create_dynamic_qr(
            account_id=settings.corpx_account_id,
            pix_key=settings.corpx_receiver_pix_key,
            amount=request.amount,
            expiration_date=None,
            identifier=identifier,
            message=f"Pagamento antecipação NF-e {request.receivable_id[:20]}",
        )

        qr_code_base64 = None
        if qr_result.payload:
            try:
                qr_code_base64 = generate_qr_base64(qr_result.payload)
            except Exception as qr_err:
                logger.error("Falha ao gerar QR Code base64 localmente: %s", qr_err)

        collection = CollectionOrder(
            receivable_id=request.receivable_id,
            pme_user_id=request.pme_user_id,
            debtor_name=request.debtor_name,
            debtor_document=request.debtor_document,
            amount_cents=amount_cents,
            due_date=request.due_date,
            payment_deadline=request.payment_deadline,
            status="PENDING_PAYMENT",
            corpx_account_id=settings.corpx_account_id,
            corpx_pix_key=settings.corpx_receiver_pix_key,
            identifier=identifier,
            corpx_txid=qr_result.txid,
            qr_code_payload=qr_result.payload,
            qr_code_location=qr_result.location,
            qr_code_base64=qr_code_base64,
            metadata_json=request.metadata,
        )
        self._db.add(collection)
        await self._db.flush()

        logger.info(
            "Cobrança futura criada: collection_id=%s receivable_id=%s identifier=%s",
            collection.id, request.receivable_id, identifier,
        )

        return CollectionOrderResponse(
            collection_order_id=collection.id,
            receivable_id=collection.receivable_id,
            identifier=collection.identifier,
            amount=collection.amount,
            status=collection.status,
            debtor_name=collection.debtor_name,
            debtor_document=collection.debtor_document,
            due_date=collection.due_date,
            qr_code_payload=collection.qr_code_payload,
            qr_code_location=collection.qr_code_location,
            qr_code_base64=collection.qr_code_base64,
            end_to_end_id=collection.end_to_end_id,
            created_at=collection.created_at,
            paid_at=collection.paid_at,
        )
