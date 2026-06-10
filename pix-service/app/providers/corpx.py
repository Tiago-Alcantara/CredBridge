"""
Provider CorpX — implementação real da API CorpX v2.14.0.

Responsabilidades:
  - Gerenciar token OAuth2 (client_credentials) com cache até expires_in
  - Incluir headers obrigatórios: Authorization, X-Tenant-Id, Idempotency-Key
  - Chamar os endpoints CorpX conforme OpenAPI v2.14.0
  - Mapear respostas CorpX para os dataclasses de app.providers.base

Não faz lógica de negócio — apenas I/O com a CorpX.
"""

from __future__ import annotations

import logging
import time
import uuid
from datetime import datetime, timezone

import httpx

from app.config import settings
from app.providers.base import (
    CreateQrCodeResult,
    DictLookupResult,
    PaymentStatus,
    PixOutResult,
    PixProvider,
    QrCodeStatus,
)

logger = logging.getLogger("uvicorn.error")


class CorpXClient(PixProvider):
    """
    Cliente HTTP para a API CorpX v2.14.0.

    Mantém um único httpx.AsyncClient com timeout configurado.
    O token OAuth2 é cacheado em memória e renovado quando expira.
    """

    def __init__(self) -> None:
        self._http = httpx.AsyncClient(timeout=30.0)
        self._access_token: str | None = None
        self._token_expires_at: float = 0.0  # Unix timestamp

    # ------------------------------------------------------------------ #
    # Auth
    # ------------------------------------------------------------------ #

    async def _get_access_token(self) -> str:
        """Retorna token cacheado ou obtém um novo se expirado (margem de 60 s)."""
        now = time.monotonic()
        if self._access_token and now < self._token_expires_at - 60:
            return self._access_token

        logger.info(
            "Renovando token OAuth2 CorpX em %s",
            settings.corpx_auth_base_url
        )
        response = await self._http.post(
            f"{settings.corpx_auth_base_url}/oauth2/token",
            data={
                "grant_type": "client_credentials",
                "client_id": settings.corpx_client_id,
                "client_secret": settings.corpx_client_secret,
                **({"scope": settings.corpx_scope} if settings.corpx_scope else {}),
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )

        logger.info("OAuth2 Token Response: status_code=%s, body=%s", response.status_code, response.text)

        if response.status_code != 200:
            logger.error("Falha ao obter token CorpX: %s %s", response.status_code, response.text)
            raise RuntimeError(
                f"Falha ao obter token CorpX: {response.status_code} {response.text}"
            )

        data = response.json()
        self._access_token = data["access_token"]
        self._token_expires_at = now + int(data.get("expires_in", 3600))
        return self._access_token

    def _build_headers(self, idempotency_key: str | None = None) -> dict[str, str]:
        """Constrói headers comuns para chamadas à API CorpX."""
        headers: dict[str, str] = {
            "Authorization": f"Bearer {self._access_token}",
            "X-Tenant-Id": settings.corpx_tenant_id,
            "Content-Type": "application/json",
        }
        if idempotency_key:
            headers["Idempotency-Key"] = idempotency_key
        return headers

    async def _authorized_request(
        self,
        method: str,
        url: str,
        idempotency_key: str | None = None,
        **kwargs,
    ) -> httpx.Response:
        """
        Executa uma requisição autenticada, renovando o token se necessário.

        Em caso de 401, tenta renovar o token uma vez antes de falhar.
        """
        await self._get_access_token()
        headers = self._build_headers(idempotency_key)
        
        # Log da requisição de saída (ofuscando o token)
        safe_headers = {k: v if k != "Authorization" else "Bearer [REDACTED]" for k, v in headers.items()}
        logger.info(
            "Enviando requisição para CorpX: %s %s | Headers: %s | Params/Body: %s",
            method, url, safe_headers, kwargs
        )

        response = await self._http.request(method, url, headers=headers, **kwargs)

        logger.info(
            "Resposta recebida da CorpX: %s %s | Status: %s | Body: %s",
            method, url, response.status_code, response.text
        )

        if response.status_code == 401:
            logger.warning("Token expirado (401) ao chamar CorpX. Renovando e tentando novamente...")
            self._access_token = None
            await self._get_access_token()
            headers = self._build_headers(idempotency_key)
            
            safe_headers = {k: v if k != "Authorization" else "Bearer [REDACTED]" for k, v in headers.items()}
            logger.info(
                "Tentando novamente requisição CorpX: %s %s | Headers: %s | Params/Body: %s",
                method, url, safe_headers, kwargs
            )
            response = await self._http.request(method, url, headers=headers, **kwargs)
            logger.info(
                "Resposta recebida da CorpX (segunda tentativa): %s %s | Status: %s | Body: %s",
                method, url, response.status_code, response.text
            )

        return response

    # ------------------------------------------------------------------ #
    # QR Code dinâmico (depósitos)
    # ------------------------------------------------------------------ #

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
        idempotency_key = f"qr-{identifier}"
        url = f"{settings.corpx_api_base_url}/v1/accounts/{account_id}/pix/qr-code/dynamic"

        body: dict = {
            "pixKey": pix_key,
            "value": round(amount, 2),
            "allowChangeValue": allow_change_value,
            "identifier": identifier,
            "payerPhysicalPerson": False,
        }
        if expiration_date:
            body["expirationDate"] = expiration_date.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
        if message:
            body["message"] = message

        logger.info("Criando QR dinâmico CorpX: identifier=%s amount=%.2f", identifier, amount)
        response = await self._authorized_request(
            "POST", url, idempotency_key=idempotency_key, json=body
        )

        if response.status_code not in (200, 201):
            raise RuntimeError(
                f"Erro CorpX ao criar QR: {response.status_code} {response.text}"
            )

        data = response.json().get("data", response.json())
        return CreateQrCodeResult(
            txid=data.get("txid", ""),
            payload=data.get("payload", data.get("emv", "")),
            location=data.get("location", ""),
            identifier=data.get("identifier", identifier),
            status=data.get("status", "active"),
            pix_key=data.get("chave", pix_key),
        )

    async def lookup_qr(
        self,
        *,
        account_id: str,
        identifier: str,
    ) -> QrCodeStatus:
        url = f"{settings.corpx_api_base_url}/v1/accounts/{account_id}/pix/qr-code/lookup"
        response = await self._authorized_request(
            "GET", url, params={"identifier": identifier}
        )

        if response.status_code == 404:
            raise ValueError(f"QR Code não encontrado na CorpX: identifier={identifier}")

        if response.status_code != 200:
            raise RuntimeError(f"Erro CorpX lookup QR: {response.status_code} {response.text}")

        data = response.json().get("data", response.json())
        paid_at_raw = data.get("paidAt")
        paid_at = datetime.fromisoformat(paid_at_raw) if paid_at_raw else None

        return QrCodeStatus(
            txid=data.get("txid", ""),
            identifier=data.get("identifier", identifier),
            status=data.get("status", ""),
            emv=data.get("emv"),
            paid_at=paid_at,
            paid_amount=data.get("paidAmount"),
            end_to_end_id=data.get("endToEndId"),
            transaction_id=data.get("transactionId"),
        )

    async def cancel_qr(
        self,
        *,
        account_id: str,
        identifier: str,
    ) -> None:
        url = f"{settings.corpx_api_base_url}/v1/accounts/{account_id}/pix/qr-code"
        response = await self._authorized_request(
            "DELETE", url, params={"identifier": identifier}
        )

        if response.status_code not in (200, 204):
            raise RuntimeError(
                f"Erro CorpX ao cancelar QR: {response.status_code} {response.text}"
            )

        logger.info("QR cancelado na CorpX: identifier=%s", identifier)

    # ------------------------------------------------------------------ #
    # DICT (validação de chave Pix)
    # ------------------------------------------------------------------ #

    async def dict_lookup(
        self,
        *,
        account_id: str,
        pix_key: str,
        key_type: str,
    ) -> DictLookupResult:
        url = f"{settings.corpx_api_base_url}/v1/accounts/{account_id}/pix/key/{pix_key}"
        response = await self._authorized_request(
            "GET", url, params={"keyType": key_type, "noCache": "false"}
        )

        if response.status_code == 404:
            raise ValueError(f"Chave Pix não encontrada no DICT: {pix_key}")

        if response.status_code != 200:
            raise RuntimeError(f"Erro DICT CorpX: {response.status_code} {response.text}")

        data = response.json().get("data", response.json())

        # O proprietário pode estar no nível superior (flat) ou em um objeto 'owner' aninhado
        if "ownerName" in data or "ownerDocument" in data:
            owner_name = data.get("ownerName", "")
            owner_document = data.get("ownerDocument", "")
        else:
            owner = data.get("owner", {})
            if isinstance(owner, dict):
                owner_name = owner.get("name", "")
                owner_document = owner.get("taxIdNumber", owner.get("document", ""))
            else:
                owner_name = ""
                owner_document = ""

        # O banco pode estar no nível superior (flat) ou em 'account.participant' aninhado
        if "bankName" in data or "bankIspb" in data:
            bank_name = data.get("bankName")
            bank_ispb = data.get("bankIspb")
        else:
            account_field = data.get("account", {})
            if isinstance(account_field, dict):
                participant = account_field.get("participant", {})
                if isinstance(participant, dict):
                    bank_name = participant.get("name")
                    bank_ispb = participant.get("ispb")
                else:
                    bank_name = None
                    bank_ispb = None
            else:
                bank_name = None
                bank_ispb = None

        return DictLookupResult(
            pix_key=pix_key,
            key_type=key_type,
            owner_name=owner_name,
            owner_document=owner_document,
            bank_name=bank_name,
            bank_ispb=bank_ispb,
        )

    # ------------------------------------------------------------------ #
    # Pix Out (saques)
    # ------------------------------------------------------------------ #

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
        idempotency_key = f"pixout-{identifier}"
        url = f"{settings.corpx_api_base_url}/v1/accounts/{account_id}/pix/out/async"

        body: dict = {
            "accountId": account_id,
            "keyType": key_type,
            "key": key,
            "amount": round(amount, 2),
            "currency": "BRL",
            "identifier": identifier,
        }
        if description:
            body["description"] = description
        if metadata:
            body["metadata"] = metadata

        logger.info(
            "Criando Pix Out async CorpX: identifier=%s key=%s amount=%.2f",
            identifier, key, amount,
        )
        response = await self._authorized_request(
            "POST", url, idempotency_key=idempotency_key, json=body
        )

        # 207 Multi-Status = timeout do parceiro — NÃO retry cego
        if response.status_code == 207:
            logger.warning(
                "CorpX retornou 207 para Pix Out identifier=%s — aguardar webhook ou lookup",
                identifier,
            )
            data = response.json()
            return PixOutResult(
                payment_id=data.get("paymentId", ""),
                status="PENDING",
                end_to_end_id=data.get("endToEndId"),
                amount=amount,
                scheduled=False,
            )

        if response.status_code not in (200, 201, 202):
            raise RuntimeError(
                f"Erro CorpX Pix Out: {response.status_code} {response.text}"
            )

        data = response.json()
        return PixOutResult(
            payment_id=data.get("paymentId", ""),
            status=data.get("status", "SCHEDULED"),
            end_to_end_id=data.get("endToEndId"),
            amount=amount,
            scheduled=data.get("scheduled", True),
        )

    async def lookup_payment(
        self,
        *,
        account_id: str,
        identifier: str,
    ) -> PaymentStatus:
        url = f"{settings.corpx_api_base_url}/v1/accounts/{account_id}/pix/payments/lookup"
        response = await self._authorized_request(
            "GET", url, params={"identifier": identifier}
        )

        if response.status_code == 404:
            raise ValueError(f"Pagamento não encontrado na CorpX: identifier={identifier}")

        if response.status_code != 200:
            raise RuntimeError(
                f"Erro CorpX lookup payment: {response.status_code} {response.text}"
            )

        data = response.json().get("data", response.json())
        return PaymentStatus(
            payment_id=data.get("paymentId", ""),
            identifier=data.get("identifier", identifier),
            status=data.get("status", ""),
            end_to_end_id=data.get("endToEndId"),
            amount=data.get("amount"),
        )

    async def close(self) -> None:
        await self._http.aclose()
