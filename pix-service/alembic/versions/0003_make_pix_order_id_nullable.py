"""Make pix_order_id nullable in outbox_callbacks.

Revision ID: 0003
Revises: 0002
Create Date: 2026-06-10
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "outbox_callbacks",
        "pix_order_id",
        existing_type=postgresql.UUID(as_uuid=False),
        nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "outbox_callbacks",
        "pix_order_id",
        existing_type=postgresql.UUID(as_uuid=False),
        nullable=False,
    )
