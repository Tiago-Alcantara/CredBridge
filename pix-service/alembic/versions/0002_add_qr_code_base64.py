"""Add qr_code_base64 column to pix_orders and collection_orders.

Revision ID: 0002
Revises: 0001
Create Date: 2026-06-07
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("pix_orders", sa.Column("qr_code_base64", sa.Text(), nullable=True))
    op.add_column("collection_orders", sa.Column("qr_code_base64", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("pix_orders", "qr_code_base64")
    op.drop_column("collection_orders", "qr_code_base64")
