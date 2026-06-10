"""
Provider sandbox — implementação mock para testes locais e CI.

Simula respostas da CorpX sem fazer chamadas HTTP reais.
Ativado quando PIX_PROVIDER=sandbox.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from app.providers.base import (
    CreateQrCodeResult,
    DictLookupResult,
    PaymentStatus,
    PixOutResult,
    PixProvider,
    QrCodeStatus,
)


class SandboxPixProvider(PixProvider):
    """
    Provider mock para desenvolvimento e testes.

    Todos os métodos retornam dados fictícios bem-formados sem chamar a CorpX.
    """

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
    ) -> CreateQrCodeResult:
        fake_txid = f"sandbox-txid-{uuid.uuid4().hex[:12]}"
        fake_emv = (
            f"00020126580014br.gov.bcb.pix0136{fake_txid}"
            f"5204000053039865802BR5913CredBridge6008Sao Paulo"
            f"62070503***6304ABCD"
        )
        return CreateQrCodeResult(
            txid=fake_txid,
            payload=fake_emv,
            location=f"https://sandbox.pix.example.com/qr/{fake_txid}",
            identifier=identifier,
            status="active",
            pix_key=pix_key,
        )

    async def lookup_qr(
        self,
        *,
        account_id: str,
        identifier: str,
    ) -> QrCodeStatus:
        return QrCodeStatus(
            txid=f"sandbox-txid-{identifier}",
            identifier=identifier,
            status="active",
            emv=None,
            paid_at=None,
            paid_amount=None,
            end_to_end_id=None,
            transaction_id=None,
        )

    async def cancel_qr(
        self,
        *,
        account_id: str,
        identifier: str,
    ) -> None:
        pass  # No-op em sandbox

    async def dict_lookup(
        self,
        *,
        account_id: str,
        pix_key: str,
        key_type: str,
    ) -> DictLookupResult:
        return DictLookupResult(
            pix_key=pix_key,
            key_type=key_type,
            owner_name="Usuário Sandbox",
            owner_document="12345678900",
            bank_name="Banco Sandbox",
            bank_ispb="00000000",
        )

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
    ) -> PixOutResult:
        return PixOutResult(
            payment_id=f"sandbox-payment-{uuid.uuid4().hex[:12]}",
            status="SCHEDULED",
            end_to_end_id=f"E00000000{uuid.uuid4().hex[:20].upper()}",
            amount=amount,
            scheduled=True,
        )

    async def lookup_payment(
        self,
        *,
        account_id: str,
        identifier: str,
    ) -> PaymentStatus:
        return PaymentStatus(
            payment_id=f"sandbox-payment-{identifier}",
            identifier=identifier,
            status="APPROVED",
            end_to_end_id=None,
            amount=None,
        )
