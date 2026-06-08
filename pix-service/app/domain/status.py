"""
Status normalizado do microserviço Pix e máquina de estados.

Todos os status externos (CorpX, Banco Central) são mapeados para
este conjunto canônico antes de persistir em pix_orders.
"""

from __future__ import annotations

from enum import StrEnum


class PixOrderStatus(StrEnum):
    CREATED = "CREATED"
    PENDING_PAYMENT = "PENDING_PAYMENT"    # QR CorpX criado e ativo
    PROCESSING = "PROCESSING"              # Pix Out enviado ou agendado
    CONFIRMED = "CONFIRMED"               # QR pago ou Pix Out concluído
    FAILED = "FAILED"                     # Pix Out falhou ou provider rejeitou
    EXPIRED = "EXPIRED"                   # QR expirado
    CANCELED = "CANCELED"                 # QR cancelado
    TIMEOUT = "TIMEOUT"                   # Pix Out com timeout — exige lookup
    REFUNDED = "REFUNDED"                 # Devolução confirmada


class PixOrderType(StrEnum):
    DEPOSIT = "DEPOSIT"
    WITHDRAWAL = "WITHDRAWAL"


class OwnerRole(StrEnum):
    PME = "pme"
    INVESTOR = "investor"


class CollectionOrderStatus(StrEnum):
    PENDING_PAYMENT = "PENDING_PAYMENT"
    PAID = "PAID"
    EXPIRED = "EXPIRED"
    CANCELED = "CANCELED"
    FAILED = "FAILED"


# Transições válidas: status_atual → conjunto de próximos status permitidos
ALLOWED_TRANSITIONS: dict[PixOrderStatus, set[PixOrderStatus]] = {
    PixOrderStatus.CREATED: {
        PixOrderStatus.PENDING_PAYMENT,
        PixOrderStatus.PROCESSING,
        PixOrderStatus.FAILED,
    },
    PixOrderStatus.PENDING_PAYMENT: {
        PixOrderStatus.CONFIRMED,
        PixOrderStatus.EXPIRED,
        PixOrderStatus.CANCELED,
        PixOrderStatus.FAILED,
    },
    PixOrderStatus.PROCESSING: {
        PixOrderStatus.CONFIRMED,
        PixOrderStatus.FAILED,
        PixOrderStatus.TIMEOUT,
        PixOrderStatus.REFUNDED,
    },
    PixOrderStatus.TIMEOUT: {
        PixOrderStatus.CONFIRMED,
        PixOrderStatus.FAILED,
        PixOrderStatus.REFUNDED,
    },
    # Terminais — sem transições permitidas
    PixOrderStatus.CONFIRMED: set(),
    PixOrderStatus.FAILED: set(),
    PixOrderStatus.EXPIRED: set(),
    PixOrderStatus.CANCELED: set(),
    PixOrderStatus.REFUNDED: set(),
}

TERMINAL_STATUSES = {
    PixOrderStatus.CONFIRMED,
    PixOrderStatus.FAILED,
    PixOrderStatus.EXPIRED,
    PixOrderStatus.CANCELED,
    PixOrderStatus.REFUNDED,
}


def is_transition_allowed(
    current: PixOrderStatus | str,
    next_status: PixOrderStatus | str,
) -> bool:
    """Retorna True se a transição de status for permitida pela máquina de estados."""
    current_enum = PixOrderStatus(current)
    next_enum = PixOrderStatus(next_status)
    return next_enum in ALLOWED_TRANSITIONS.get(current_enum, set())


def is_terminal(status: PixOrderStatus | str) -> bool:
    return PixOrderStatus(status) in TERMINAL_STATUSES


# Mapeamento de eventos CorpX para status interno
CORPX_EVENT_TO_STATUS: dict[str, PixOrderStatus] = {
    "qrcode.paid": PixOrderStatus.CONFIRMED,
    "qrcode.expired": PixOrderStatus.EXPIRED,
    "qrcode.cancelled": PixOrderStatus.CANCELED,
    "pix.in.completed": PixOrderStatus.CONFIRMED,
    "pix.out.completed": PixOrderStatus.CONFIRMED,
    "pix.out.failed": PixOrderStatus.FAILED,
    "pix.out.timeout": PixOrderStatus.TIMEOUT,
    "pix.refund.completed": PixOrderStatus.REFUNDED,
    "pix.refund.failed": PixOrderStatus.FAILED,
}
