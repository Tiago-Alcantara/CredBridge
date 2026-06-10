"""
Testes smoke e de lógica de domínio do microserviço Pix.

Não requerem banco de dados — testam unidades isoladas:
  - money.py
  - status.py
  - security/hmac.py
  - security/signatures.py
"""

from __future__ import annotations

import hashlib
import hmac
import json
import time

import pytest

from app.domain.money import brl_to_cents, cents_to_brl, format_brl, validate_brl_amount
from app.domain.status import (
    PixOrderStatus,
    CORPX_EVENT_TO_STATUS,
    is_terminal,
    is_transition_allowed,
)
from app.security.hmac import verify_corpx_hmac_signature
from app.security.signatures import build_callback_headers


# ─────────────────────────────────────────── #
# Testes: money.py
# ─────────────────────────────────────────── #


class TestBrlToCents:
    def test_converts_whole_amount(self):
        assert brl_to_cents(150.00) == 15000

    def test_converts_with_cents(self):
        assert brl_to_cents(150.50) == 15050

    def test_converts_string_input(self):
        assert brl_to_cents("1000.00") == 100000

    def test_rejects_negative(self):
        with pytest.raises(ValueError):
            brl_to_cents(-10.0)

    def test_rounds_correctly(self):
        # 150.005 → 15001 (arredonda para cima)
        assert brl_to_cents("150.005") == 15001


class TestCentsToBrl:
    def test_converts_back(self):
        assert cents_to_brl(15000) == 150.0

    def test_converts_with_decimals(self):
        assert cents_to_brl(15050) == 150.5


class TestValidateBrlAmount:
    def test_accepts_valid_amount(self):
        validate_brl_amount(100.00)  # não lança

    def test_rejects_zero(self):
        with pytest.raises(ValueError):
            validate_brl_amount(0)

    def test_rejects_negative(self):
        with pytest.raises(ValueError):
            validate_brl_amount(-50.0)

    def test_rejects_too_many_decimals(self):
        with pytest.raises(ValueError):
            validate_brl_amount(100.001)


class TestFormatBrl:
    def test_formats_correctly(self):
        result = format_brl(150000)
        assert "1.500,00" in result


# ─────────────────────────────────────────── #
# Testes: status.py
# ─────────────────────────────────────────── #


class TestStatusTransitions:
    def test_created_to_pending_payment_allowed(self):
        assert is_transition_allowed(PixOrderStatus.CREATED, PixOrderStatus.PENDING_PAYMENT)

    def test_confirmed_to_any_not_allowed(self):
        assert not is_transition_allowed(PixOrderStatus.CONFIRMED, PixOrderStatus.PENDING_PAYMENT)
        assert not is_transition_allowed(PixOrderStatus.CONFIRMED, PixOrderStatus.FAILED)

    def test_pending_payment_to_confirmed(self):
        assert is_transition_allowed(PixOrderStatus.PENDING_PAYMENT, PixOrderStatus.CONFIRMED)

    def test_processing_to_timeout(self):
        assert is_transition_allowed(PixOrderStatus.PROCESSING, PixOrderStatus.TIMEOUT)

    def test_timeout_can_resolve(self):
        assert is_transition_allowed(PixOrderStatus.TIMEOUT, PixOrderStatus.CONFIRMED)
        assert is_transition_allowed(PixOrderStatus.TIMEOUT, PixOrderStatus.FAILED)


class TestTerminalStatuses:
    def test_confirmed_is_terminal(self):
        assert is_terminal(PixOrderStatus.CONFIRMED)

    def test_failed_is_terminal(self):
        assert is_terminal(PixOrderStatus.FAILED)

    def test_created_is_not_terminal(self):
        assert not is_terminal(PixOrderStatus.CREATED)

    def test_processing_is_not_terminal(self):
        assert not is_terminal(PixOrderStatus.PROCESSING)


class TestCorpxEventMapping:
    def test_qrcode_paid_maps_to_confirmed(self):
        assert CORPX_EVENT_TO_STATUS["qrcode.paid"] == PixOrderStatus.CONFIRMED

    def test_pix_out_failed_maps_to_failed(self):
        assert CORPX_EVENT_TO_STATUS["pix.out.failed"] == PixOrderStatus.FAILED

    def test_pix_out_timeout_maps_to_timeout(self):
        assert CORPX_EVENT_TO_STATUS["pix.out.timeout"] == PixOrderStatus.TIMEOUT


# ─────────────────────────────────────────── #
# Testes: security/hmac.py
# ─────────────────────────────────────────── #


class TestCorpxHmacVerification:
    def _make_signature(self, body: bytes, secret: str) -> str:
        digest = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
        return f"sha256={digest}"

    def test_valid_signature_passes(self):
        body = b'{"event":"test"}'
        secret = "my_secret"
        signature = self._make_signature(body, secret)
        assert verify_corpx_hmac_signature(body, signature, secret)

    def test_invalid_signature_fails(self):
        body = b'{"event":"test"}'
        assert not verify_corpx_hmac_signature(body, "sha256=invalid", "my_secret")

    def test_missing_signature_fails(self):
        body = b'{"event":"test"}'
        assert not verify_corpx_hmac_signature(body, None, "my_secret")

    def test_empty_secret_accepts_any(self):
        """Sem segredo configurado, aceita (modo permissivo para sandbox)."""
        body = b'{"event":"test"}'
        result = verify_corpx_hmac_signature(body, "sha256=anything", "")
        assert result is True

    def test_supports_plain_hex_format(self):
        """Deve funcionar sem o prefixo sha256="""
        body = b'{"event":"test"}'
        secret = "my_secret"
        plain_hex = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
        assert verify_corpx_hmac_signature(body, plain_hex, secret)


# ─────────────────────────────────────────── #
# Testes: security/signatures.py
# ─────────────────────────────────────────── #


class TestCallbackHeaders:
    def test_generates_required_headers(self):
        payload = {"event_id": "evt-1", "status": "CONFIRMED"}
        headers = build_callback_headers(payload, "evt-1", "secret123")
        assert "X-CredBridge-Pix-Timestamp" in headers
        assert "X-CredBridge-Pix-Signature" in headers
        assert "X-CredBridge-Pix-Event-Id" in headers
        assert headers["X-CredBridge-Pix-Event-Id"] == "evt-1"

    def test_signature_format(self):
        payload = {"status": "CONFIRMED"}
        headers = build_callback_headers(payload, "evt-2", "secret")
        assert headers["X-CredBridge-Pix-Signature"].startswith("sha256=")

    def test_signature_is_verifiable(self):
        """A assinatura deve poder ser verificada pela CredBridge."""
        secret = "shared_secret"
        payload = {"event_id": "evt-3", "amount": 1000.0}
        headers = build_callback_headers(payload, "evt-3", secret)

        timestamp = headers["X-CredBridge-Pix-Timestamp"]
        body_json = json.dumps(payload, separators=(",", ":"), sort_keys=True)
        message = f"{timestamp}.{body_json}".encode()
        expected_digest = hmac.new(secret.encode(), message, hashlib.sha256).hexdigest()

        received_sig = headers["X-CredBridge-Pix-Signature"].replace("sha256=", "")
        assert hmac.compare_digest(expected_digest, received_sig)

    def test_different_events_produce_different_signatures(self):
        payload_a = {"status": "CONFIRMED"}
        payload_b = {"status": "FAILED"}
        headers_a = build_callback_headers(payload_a, "evt-a", "secret")
        headers_b = build_callback_headers(payload_b, "evt-b", "secret")
        assert headers_a["X-CredBridge-Pix-Signature"] != headers_b["X-CredBridge-Pix-Signature"]
