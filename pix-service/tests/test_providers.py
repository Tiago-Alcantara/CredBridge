from __future__ import annotations

import pytest
from app.providers.corpx import CorpXClient

@pytest.mark.asyncio
async def test_corpx_dict_lookup_flat_response(httpx_mock):
    # Mock OAuth2 token generation
    httpx_mock.add_response(
        method="POST",
        url="https://auth.api.corpx.com/oauth2/token",
        json={"access_token": "fake-token", "expires_in": 3600, "token_type": "Bearer"},
    )
    
    # Mock DICT lookup response (flat structure)
    flat_response = {
        "account": "7889981909",
        "accountType": "PAYMENT",
        "bankCode": "260",
        "bankIspb": "18236120",
        "bankName": "Nu Pagamentos - IP",
        "branch": "1",
        "ownerDocument": "13505490709",
        "ownerName": "Victor Hugo Valerio Barros",
    }
    httpx_mock.add_response(
        method="GET",
        url="https://tenant.api.corpx.com/v1/accounts/acc123/pix/key/my-pix-key?keyType=PHONE&noCache=false",
        json=flat_response,
    )
    
    client = CorpXClient()
    result = await client.dict_lookup(
        account_id="acc123",
        pix_key="my-pix-key",
        key_type="PHONE",
    )
    
    assert result.pix_key == "my-pix-key"
    assert result.key_type == "PHONE"
    assert result.owner_name == "Victor Hugo Valerio Barros"
    assert result.owner_document == "13505490709"
    assert result.bank_name == "Nu Pagamentos - IP"
    assert result.bank_ispb == "18236120"
    
    await client.close()


@pytest.mark.asyncio
async def test_corpx_dict_lookup_nested_response(httpx_mock):
    # Mock OAuth2 token generation
    httpx_mock.add_response(
        method="POST",
        url="https://auth.api.corpx.com/oauth2/token",
        json={"access_token": "fake-token", "expires_in": 3600, "token_type": "Bearer"},
    )
    
    # Mock DICT lookup response (legacy nested structure)
    nested_response = {
        "owner": {
            "name": "Maria da Silva",
            "taxIdNumber": "98765432100",
        },
        "account": {
            "participant": {
                "name": "Banco do Brasil",
                "ispb": "00000000",
            }
        }
    }
    httpx_mock.add_response(
        method="GET",
        url="https://tenant.api.corpx.com/v1/accounts/acc123/pix/key/my-pix-key?keyType=PHONE&noCache=false",
        json=nested_response,
    )
    
    client = CorpXClient()
    result = await client.dict_lookup(
        account_id="acc123",
        pix_key="my-pix-key",
        key_type="PHONE",
    )
    
    assert result.pix_key == "my-pix-key"
    assert result.key_type == "PHONE"
    assert result.owner_name == "Maria da Silva"
    assert result.owner_document == "98765432100"
    assert result.bank_name == "Banco do Brasil"
    assert result.bank_ispb == "00000000"
    
    await client.close()
