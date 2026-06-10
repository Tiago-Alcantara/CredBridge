"""Initial migration — creates all Pix microservice tables.

Revision ID: 0001
Revises:
Create Date: 2026-06-06
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # pix_orders
    op.create_table(
        "pix_orders",
        sa.Column("id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("external_id", sa.String(255), nullable=False),
        sa.Column("identifier", sa.String(35), nullable=False),
        sa.Column("type", sa.String(20), nullable=False),
        sa.Column("owner_id", sa.String(255), nullable=False),
        sa.Column("owner_role", sa.String(20), nullable=False),
        sa.Column("amount_cents", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(30), nullable=False, server_default="CREATED"),
        sa.Column("corpx_account_id", sa.String(255), nullable=True),
        sa.Column("corpx_tenant_id", sa.String(255), nullable=True),
        sa.Column("corpx_pix_key", sa.String(255), nullable=True),
        sa.Column("corpx_txid", sa.String(255), nullable=True),
        sa.Column("corpx_payment_id", sa.String(255), nullable=True),
        sa.Column("corpx_transaction_id", sa.String(255), nullable=True),
        sa.Column("end_to_end_id", sa.String(255), nullable=True),
        sa.Column("qr_code_payload", sa.Text(), nullable=True),
        sa.Column("qr_code_location", sa.String(512), nullable=True),
        sa.Column("pix_key", sa.String(255), nullable=True),
        sa.Column("pix_key_type", sa.String(20), nullable=True),
        sa.Column("description", sa.String(512), nullable=True),
        sa.Column("metadata_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("failed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("failure_reason", sa.String(512), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("external_id"),
        sa.UniqueConstraint("identifier"),
    )
    op.create_index("ix_pix_orders_external_id", "pix_orders", ["external_id"])
    op.create_index("ix_pix_orders_identifier", "pix_orders", ["identifier"])
    op.create_index("ix_pix_orders_status", "pix_orders", ["status"])
    op.create_index("ix_pix_orders_owner_id", "pix_orders", ["owner_id"])

    # pix_events
    op.create_table(
        "pix_events",
        sa.Column("id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("event_id", sa.String(255), nullable=False),
        sa.Column("pix_order_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("source", sa.String(50), nullable=False),
        sa.Column("event_type", sa.String(100), nullable=False),
        sa.Column("payload_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["pix_order_id"], ["pix_orders.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("event_id"),
    )
    op.create_index("ix_pix_events_pix_order_id", "pix_events", ["pix_order_id"])
    op.create_index("ix_pix_events_event_id", "pix_events", ["event_id"])

    # outbox_callbacks
    op.create_table(
        "outbox_callbacks",
        sa.Column("id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("event_id", sa.String(255), nullable=False),
        sa.Column("pix_order_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("target_url", sa.String(512), nullable=False),
        sa.Column("payload_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="PENDING"),
        sa.Column("attempt_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("next_attempt_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["pix_order_id"], ["pix_orders.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("event_id"),
    )
    op.create_index("ix_outbox_callbacks_status", "outbox_callbacks", ["status"])
    op.create_index("ix_outbox_callbacks_pix_order_id", "outbox_callbacks", ["pix_order_id"])
    op.create_index(
        "ix_outbox_callbacks_next_attempt_at", "outbox_callbacks", ["next_attempt_at"]
    )

    # collection_orders
    op.create_table(
        "collection_orders",
        sa.Column("id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("receivable_id", sa.String(255), nullable=False),
        sa.Column("pme_user_id", sa.String(255), nullable=False),
        sa.Column(
            "created_from_withdrawal_order_id",
            postgresql.UUID(as_uuid=False),
            nullable=True,
        ),
        sa.Column("debtor_name", sa.String(255), nullable=False),
        sa.Column("debtor_document", sa.String(20), nullable=False),
        sa.Column("amount_cents", sa.Integer(), nullable=False),
        sa.Column("due_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("payment_deadline", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(30), nullable=False, server_default="PENDING_PAYMENT"),
        sa.Column("corpx_account_id", sa.String(255), nullable=True),
        sa.Column("corpx_pix_key", sa.String(255), nullable=True),
        sa.Column("identifier", sa.String(35), nullable=False),
        sa.Column("corpx_txid", sa.String(255), nullable=True),
        sa.Column("qr_code_payload", sa.Text(), nullable=True),
        sa.Column("qr_code_location", sa.String(512), nullable=True),
        sa.Column("end_to_end_id", sa.String(255), nullable=True),
        sa.Column("metadata_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["created_from_withdrawal_order_id"], ["pix_orders.id"]
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("identifier"),
    )
    op.create_index(
        "ix_collection_orders_receivable_id", "collection_orders", ["receivable_id"]
    )
    op.create_index("ix_collection_orders_identifier", "collection_orders", ["identifier"])
    op.create_index("ix_collection_orders_status", "collection_orders", ["status"])


def downgrade() -> None:
    op.drop_table("collection_orders")
    op.drop_table("outbox_callbacks")
    op.drop_table("pix_events")
    op.drop_table("pix_orders")
