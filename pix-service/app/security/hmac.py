"""
Validação de assinatura HMAC para webhooks recebidos da CorpX.

A CorpX assina cada webhook com HMAC-SHA256 usando o segredo configurado
na subscription. O header com a assinatura varia por configuração; aqui
assumimos o header `X-CorpX-Signature` com formato `sha256=<hex_digest>`.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import logging

logger = logging.getLogger(__name__)


def verify_corpx_hmac_signature(
    raw_body: bytes,
    signature_header: str | None,
    secret: str,
) -> bool:
    """
    Valida a assinatura HMAC-SHA256 de um webhook CorpX.
    Suporta tanto a assinatura em Base64 (padrão CorpX X-Signature)
    quanto em Hexadecimal (X-CorpX-Signature).

    Args:
        raw_body: Corpo bruto da requisição HTTP (bytes).
        signature_header: Valor do header contendo a assinatura.
        secret: Segredo HMAC configurado na subscription CorpX.

    Returns:
        True se a assinatura for válida, False caso contrário.
    """
    if not signature_header:
        logger.warning("Webhook CorpX recebido sem header de assinatura")
        return False

    if not secret:
        # Em sandbox sem segredo configurado, aceita (log de aviso)
        logger.warning(
            "CORPX_WEBHOOK_SECRET não configurado — pulando validação de assinatura"
        )
        return True

    # Remove espaços em branco
    sig = signature_header.strip()

    # Suporta formato "sha256=<hex>" ou direto "<hex>" para hex
    expected_prefix = "sha256="
    sig_clean = (
        sig[len(expected_prefix):]
        if sig.startswith(expected_prefix)
        else sig
    )

    # 1. Calcula o HMAC esperado em Base64 (especificação do X-Signature)
    h = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256)
    expected_base64 = base64.b64encode(h.digest()).decode("utf-8")

    # 2. Calcula o HMAC esperado em Hex (especificação do X-CorpX-Signature)
    expected_hex = h.hexdigest()

    # Compara contra ambas as possibilidades para máxima compatibilidade
    is_valid = hmac.compare_digest(expected_base64, sig) or hmac.compare_digest(expected_hex, sig_clean.lower())

    if not is_valid:
        logger.warning(
            f"Assinatura HMAC CorpX inválida. Recebido: {signature_header}. "
            f"Esperado (Base64): {expected_base64} ou (Hex): {expected_hex}"
        )

    return is_valid
