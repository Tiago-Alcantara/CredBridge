"""
Interface base para providers Pix.

Define o contrato que qualquer provider (CorpX, sandbox, etc.) deve implementar.
O serviço de ordens usa apenas esta interface, sem depender do provider concreto.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime


@dataclass
class CreateQrCodeResult:
    txid: str
    payload: str           # EMV copia-e-cola
    location: str
    identifier: str
    status: str
    pix_key: str


@dataclass
class QrCodeStatus:
    txid: str
    identifier: str
    status: str            # active | paid | cancelled | expired
    emv: str | None
    paid_at: datetime | None
    paid_amount: float | None
    end_to_end_id: str | None
    transaction_id: str | None


@dataclass
class PixOutResult:
    payment_id: str
    status: str            # APPROVED | PENDING | PROCESSING | REJECTED | SCHEDULED
    end_to_end_id: str | None
    amount: float
    scheduled: bool = False


@dataclass
class PaymentStatus:
    payment_id: str
    identifier: str
    status: str
    end_to_end_id: str | None
    amount: float | None


@dataclass
class DictLookupResult:
    pix_key: str
    key_type: str
    owner_name: str
    owner_document: str
    bank_name: str | None
    bank_ispb: str | None


class PixProvider(ABC):
    """Contrato para todos os providers Pix."""

    @abstractmethod
    async def create_dynamic_qr(
        self,
        *,
        account_id: str,
        pix_key: str,
        amount: float,
        expiration_date: datetime | None = None,
        identifier: str,
        message: str | None,
        allow_change_value: bool = False,
    ) -> CreateQrCodeResult: ...

    @abstractmethod
    async def lookup_qr(
        self,
        *,
        account_id: str,
        identifier: str,
    ) -> QrCodeStatus: ...

    @abstractmethod
    async def cancel_qr(
        self,
        *,
        account_id: str,
        identifier: str,
    ) -> None: ...

    @abstractmethod
    async def dict_lookup(
        self,
        *,
        account_id: str,
        pix_key: str,
        key_type: str,
    ) -> DictLookupResult: ...

    @abstractmethod
    async def create_pix_out_async(
        self,
        *,
        account_id: str,
        key_type: str,
        key: str,
        amount: float,
        identifier: str,
        description: str | None,
        metadata: dict | None,
    ) -> PixOutResult: ...

    @abstractmethod
    async def lookup_payment(
        self,
        *,
        account_id: str,
        identifier: str,
    ) -> PaymentStatus: ...
