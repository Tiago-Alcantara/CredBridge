"""
Geração de assinatura HMAC para callbacks enviados à CredBridge.

O microserviço assina cada callback com HMAC-SHA256 usando o segredo
compartilhado `CREDBRIDGE_PIX_WEBHOOK_SECRET`. A CredBridge deve validar
essa assinatura antes de processar qualquer efeito de token.

Headers gerados:
  X-CredBridge-Pix-Timestamp  — Unix timestamp (str) do momento do envio
  X-CredBridge-Pix-Signature  — sha256=<hex_digest> do corpo + timestamp
  X-CredBridge-Pix-Event-Id   — event_id único do callback (idempotência)
"""

from __future__ import annotations

import hashlib
import hmac
import json
import time
from typing import Any


def build_callback_headers(
    payload: dict[str, Any],
    event_id: str,
    secret: str,
) -> dict[str, str]:
    """
    Constrói os headers de autenticação para o callback à CredBridge.

    A mensagem assinada é: `<timestamp>.<json_body>`.
    Isso vincula a assinatura ao momento do envio, permitindo à CredBridge
    rejeitar replays com timestamp muito antigo (ex: > 300 s).

    Args:
        payload: Dicionário com o payload do callback (será serializado como JSON).
        event_id: Identificador único do evento (para idempotência na CredBridge).
        secret: Segredo compartilhado `CREDBRIDGE_PIX_WEBHOOK_SECRET`.

    Returns:
        Dicionário de headers prontos para incluir na requisição HTTP.
    """
    timestamp = str(int(time.time()))
    body_json = json.dumps(payload, separators=(",", ":"), sort_keys=True)
    message = f"{timestamp}.{body_json}".encode("utf-8")

    signature_hex = hmac.new(
        secret.encode("utf-8"),
        message,
        hashlib.sha256,
    ).hexdigest()

    return {
        "X-CredBridge-Pix-Timestamp": timestamp,
        "X-CredBridge-Pix-Signature": f"sha256={signature_hex}",
        "X-CredBridge-Pix-Event-Id": event_id,
        "Content-Type": "application/json",
    }
