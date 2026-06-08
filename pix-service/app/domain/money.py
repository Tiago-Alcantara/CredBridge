"""
Utilitários de dinheiro BRL.

Operações financeiras usam centavos (int) internamente para eliminar
problemas de ponto flutuante. As funções abaixo convertem entre as
representações e validam precisão.
"""

from __future__ import annotations

import math
from decimal import ROUND_HALF_UP, Decimal


def brl_to_cents(amount: float | Decimal | str) -> int:
    """
    Converte valor BRL (ex: 150.00) para centavos inteiros (ex: 15000).

    Usa Decimal internamente para arredondar corretamente.
    Lança ValueError se o valor tiver mais de 2 casas decimais.
    """
    d = Decimal(str(amount)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    if d < 0:
        raise ValueError(f"Valor BRL não pode ser negativo: {amount}")
    return int(d * 100)


def cents_to_brl(cents: int) -> float:
    """Converte centavos inteiros para float BRL com 2 casas decimais."""
    return round(cents / 100, 2)


def cents_to_brl_decimal(cents: int) -> Decimal:
    """Converte centavos inteiros para Decimal BRL com 2 casas decimais."""
    return Decimal(cents) / Decimal(100)


def validate_brl_amount(amount: float | Decimal | str) -> None:
    """
    Lança ValueError se o valor BRL for inválido:
      - negativo ou zero
      - mais de 2 casas decimais
    """
    d = Decimal(str(amount))
    if d <= 0:
        raise ValueError(f"Valor BRL deve ser positivo: {amount}")
    # Verifica casas decimais
    exponent = d.as_tuple().exponent
    if isinstance(exponent, int) and exponent < -2:
        raise ValueError(f"Valor BRL com mais de 2 casas decimais: {amount}")


def format_brl(cents: int) -> str:
    """Formata centavos como string BRL, ex: 'R$ 1.500,00'."""
    brl = cents_to_brl(cents)
    return f"R$ {brl:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
