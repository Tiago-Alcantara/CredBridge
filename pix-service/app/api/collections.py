"""
Router de cobranças futuras (collection orders).

Endpoint para criar cobranças vinculadas a NF-e antecipadas, consultar
e cancelar.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.domain.models import CollectionOrder
from app.domain.schemas import (
    CollectionOrderResponse,
    CreateCollectionOrderRequest,
)
from app.providers.base import PixProvider
from app.providers.corpx import CorpXClient
from app.providers.sandbox import SandboxPixProvider
from app.services.orders_service import OrdersService

router = APIRouter(prefix="/v1/collections", tags=["collections"])
logger = logging.getLogger(__name__)


def _get_provider() -> PixProvider:
    if settings.pix_provider == "sandbox":
        return SandboxPixProvider()
    return CorpXClient()


def _require_api_key(x_api_key: str = Header(...)) -> None:
    expected_key = settings.credbridge_pix_service_api_key
    if expected_key and x_api_key != expected_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API key inválida",
        )


def _collection_to_response(collection: CollectionOrder) -> CollectionOrderResponse:
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
        end_to_end_id=collection.end_to_end_id,
        created_at=collection.created_at,
        paid_at=collection.paid_at,
    )


@router.post(
    "",
    response_model=CollectionOrderResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Criar cobrança futura ao sacado com QR dinâmico imediato",
)
async def create_collection(
    request: CreateCollectionOrderRequest,
    db: AsyncSession = Depends(get_db),
    _auth: None = Depends(_require_api_key),
) -> CollectionOrderResponse:
    service = OrdersService(db=db, provider=_get_provider())
    try:
        return await service.create_collection(request)
    except ValueError as validation_error:
        logger.warning("Erro de validação ao criar cobrança: %s", validation_error)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(validation_error),
        ) from validation_error
    except RuntimeError as provider_error:
        logger.exception("Erro no provider CorpX ao criar cobrança")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Erro no provider CorpX: {provider_error}",
        ) from provider_error


@router.get(
    "/{collection_id}",
    response_model=CollectionOrderResponse,
    summary="Consultar cobrança futura pelo ID",
)
async def get_collection(
    collection_id: str,
    db: AsyncSession = Depends(get_db),
    _auth: None = Depends(_require_api_key),
) -> CollectionOrderResponse:
    result = await db.execute(
        select(CollectionOrder).where(CollectionOrder.id == collection_id)
    )
    collection = result.scalar_one_or_none()
    if not collection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Cobrança não encontrada: {collection_id}",
        )
    return _collection_to_response(collection)


@router.post(
    "/{collection_id}/cancel",
    response_model=CollectionOrderResponse,
    summary="Cancelar cobrança futura e QR Code na CorpX",
)
async def cancel_collection(
    collection_id: str,
    db: AsyncSession = Depends(get_db),
    _auth: None = Depends(_require_api_key),
) -> CollectionOrderResponse:
    result = await db.execute(
        select(CollectionOrder).where(CollectionOrder.id == collection_id)
    )
    collection = result.scalar_one_or_none()

    if not collection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Cobrança não encontrada: {collection_id}",
        )

    if collection.status in ("PAID", "CANCELED", "EXPIRED"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cobrança em status '{collection.status}' não pode ser cancelada",
        )

    provider = _get_provider()
    try:
        await provider.cancel_qr(
            account_id=settings.corpx_account_id,
            identifier=collection.identifier,
        )
    except Exception as cancel_error:
        logger.exception("Erro ao cancelar QR na CorpX para cobrança %s", collection_id)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Erro ao cancelar QR na CorpX: {cancel_error}",
        ) from cancel_error

    collection.status = "CANCELED"
    return _collection_to_response(collection)
