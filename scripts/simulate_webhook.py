#!/usr/bin/env python3
"""
Script utilitário para simular webhooks de pagamento do gateway CorpX.
Calcula a assinatura HMAC-SHA256 correta e envia a requisição para o microserviço Pix.
"""

import argparse
import base64
import hashlib
import hmac
import json
import os
import urllib.request
import uuid


def load_env(env_path):
    env = {}
    if os.path.exists(env_path):
        with open(env_path, "r") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    k, v = line.split("=", 1)
                    # Remove quotes if present
                    val = v.strip().strip('"').strip("'")
                    env[k.strip()] = val
    return env


def main():
    parser = argparse.ArgumentParser(description="Simular webhook CorpX")
    parser.add_argument("--identifier", required=True, help="Identificador curto da transação (ex: cbd_xxxx)")
    parser.add_argument("--amount", type=float, default=100.0, help="Valor do pagamento Pix em BRL")
    parser.add_argument("--target-url", default="http://localhost:8001/v1/webhooks/corpx", help="URL do webhook a enviar")
    parser.add_argument("--secret", help="Segredo HMAC da CorpX (opcional, senão lê do .env)")
    parser.add_argument("--account-id", help="ID da conta CorpX (opcional, senão lê do .env)")
    args = parser.parse_args()

    # Tenta carregar do .env do pix-service
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    env_path = os.path.join(base_dir, "pix-service", ".env")
    env = load_env(env_path)

    secret = args.secret or env.get("CORPX_WEBHOOK_SECRET")
    account_id = args.account_id or env.get("CORPX_ACCOUNT_ID")

    if not secret:
        print("Erro: CORPX_WEBHOOK_SECRET não foi fornecido e não foi encontrado no .env")
        return

    if not account_id:
        print("Aviso: CORPX_ACCOUNT_ID não foi fornecido e não foi encontrado no .env. Enviando sem accountId.")

    payload = {
        "eventId": str(uuid.uuid4()),
        "eventType": "qrcode.paid",
        "accountId": account_id,
        "data": {
            "identifier": args.identifier,
            "amount": args.amount,
            "endToEndId": f"E{uuid.uuid4().hex[:31].upper()}",
        },
    }

    body_bytes = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    signature = hmac.new(secret.encode("utf-8"), body_bytes, hashlib.sha256).hexdigest()

    print(f"Enviando webhook simulado de pagamento para: {args.target_url}")
    print(f"Identifier: {args.identifier}")
    print(f"Valor: R$ {args.amount:.2f}")
    print(f"Assinatura (HMAC-SHA256): {signature}")

    req = urllib.request.Request(
        args.target_url,
        data=body_bytes,
        headers={
            "Content-Type": "application/json",
            "X-CorpX-Signature": f"sha256={signature}",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req) as res:
            print(f"Status da resposta: {res.status}")
            print(f"Corpo da resposta: {res.read().decode('utf-8')}")
    except urllib.error.HTTPError as http_err:
        print(f"Erro HTTP {http_err.code}: {http_err.read().decode('utf-8')}")
    except Exception as err:
        print(f"Falha de conexão: {err}")


if __name__ == "__main__":
    main()
