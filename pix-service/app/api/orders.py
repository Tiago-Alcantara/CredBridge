"""
Router de ordens Pix — endpoints internos para a CredBridge.

Autenticação: API Key via header `X-Api-Key` (configurado em CREDBRIDGE_PIX_SERVICE_API_KEY).
Sem autenticação pública — este serviço só deve ser acessível pela CredBridge.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.domain.schemas import (
    CreateDepositOrderRequest,
    CreateWithdrawalOrderRequest,
    PixOrderResponse,
)
from app.providers.base import PixProvider
from app.providers.corpx import CorpXClient
from app.providers.sandbox import SandboxPixProvider
from app.services.orders_service import OrdersService
from app.services.reconciliation_service import reconcile_order

router = APIRouter(prefix="/v1/orders", tags=["orders"])
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


@router.post(
    "/deposits",
    response_model=PixOrderResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Criar ordem de depósito (QR Code dinâmico CorpX)",
)
async def create_deposit_order(
    request: CreateDepositOrderRequest,
    db: AsyncSession = Depends(get_db),
    _auth: None = Depends(_require_api_key),
) -> PixOrderResponse:
    service = OrdersService(db=db, provider=_get_provider())
    try:
        return await service.create_deposit(request)
    except ValueError as validation_error:
        logger.warning("Erro de validação ao criar depósito: %s", validation_error)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(validation_error),
        ) from validation_error
    except RuntimeError as provider_error:
        logger.exception("Erro no provider CorpX ao criar depósito")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Erro no provider CorpX: {provider_error}",
        ) from provider_error


@router.post(
    "/withdrawals",
    response_model=PixOrderResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Criar ordem de saque (Pix Out async CorpX)",
)
async def create_withdrawal_order(
    request: CreateWithdrawalOrderRequest,
    db: AsyncSession = Depends(get_db),
    _auth: None = Depends(_require_api_key),
) -> PixOrderResponse:
    service = OrdersService(db=db, provider=_get_provider())
    try:
        return await service.create_withdrawal(request)
    except ValueError as validation_error:
        logger.warning("Erro de validação ao criar saque: %s", validation_error)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(validation_error),
        ) from validation_error
    except RuntimeError as provider_error:
        logger.exception("Erro no provider CorpX ao criar saque")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Erro no provider CorpX: {provider_error}",
        ) from provider_error


@router.get(
    "/{pix_order_id}",
    response_model=PixOrderResponse,
    summary="Consultar ordem pelo ID interno",
)
async def get_order_by_id(
    pix_order_id: str,
    db: AsyncSession = Depends(get_db),
    _auth: None = Depends(_require_api_key),
) -> PixOrderResponse:
    service = OrdersService(db=db, provider=_get_provider())
    try:
        return await service.get_order_by_id(pix_order_id)
    except ValueError as not_found_error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(not_found_error),
        ) from not_found_error


@router.get(
    "/by-external-id/{external_id}",
    response_model=PixOrderResponse,
    summary="Consultar ordem pelo external_id da CredBridge",
)
async def get_order_by_external_id(
    external_id: str,
    db: AsyncSession = Depends(get_db),
    _auth: None = Depends(_require_api_key),
) -> PixOrderResponse:
    service = OrdersService(db=db, provider=_get_provider())
    try:
        return await service.get_order_by_external_id(external_id)
    except ValueError as not_found_error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(not_found_error),
        ) from not_found_error


@router.post(
    "/{pix_order_id}/cancel",
    response_model=PixOrderResponse,
    summary="Cancelar ordem (e QR Code na CorpX se depósito)",
)
async def cancel_order(
    pix_order_id: str,
    db: AsyncSession = Depends(get_db),
    _auth: None = Depends(_require_api_key),
) -> PixOrderResponse:
    service = OrdersService(db=db, provider=_get_provider())
    try:
        return await service.cancel_order(pix_order_id)
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        ) from error


@router.post(
    "/{pix_order_id}/refresh",
    response_model=PixOrderResponse,
    summary="Dispara reconciliação defensiva via lookup CorpX",
)
async def refresh_order(
    pix_order_id: str,
    db: AsyncSession = Depends(get_db),
    _auth: None = Depends(_require_api_key),
) -> PixOrderResponse:
    provider = _get_provider()
    try:
        await reconcile_order(db, provider, pix_order_id)
        service = OrdersService(db=db, provider=provider)
        return await service.get_order_by_id(pix_order_id)
    except ValueError as not_found_error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(not_found_error),
        ) from not_found_error
