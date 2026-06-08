"""
Entrypoint do microserviço Pix — FastAPI application.
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.collections import router as collections_router
from app.api.orders import router as orders_router
from app.api.webhooks import router as webhooks_router
from app.domain.schemas import HealthResponse


import asyncio
import logging
from app.database import AsyncSessionFactory
from app.services.callback_service import send_pending_callbacks



async def callback_worker() -> None:
    logger = logging.getLogger("app.worker")
    logger.info("Iniciando background callback outbox worker...")
    while True:
        try:
            async with AsyncSessionFactory() as session:
                try:
                    await send_pending_callbacks(session)
                    await session.commit()
                except Exception as db_err:
                    await session.rollback()
                    logger.error("Erro no processamento de outbox callbacks no banco: %s", db_err)
        except Exception as err:
            logger.error("Erro crítico no worker de callbacks: %s", err)
        await asyncio.sleep(5)  # Executa a cada 5 segundos

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    # Configura o sistema de logs especificamente para o pacote 'app'
    app_logger = logging.getLogger("app")
    app_logger.setLevel(logging.INFO)
    for h in app_logger.handlers[:]:
        app_logger.removeHandler(h)
    
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(name)s - %(message)s"))
    app_logger.addHandler(handler)
    app_logger.propagate = False
    
    app_logger.info("Sistema de logs do pacote 'app' inicializado no lifespan.")

    # Startup: iniciar worker
    worker_task = asyncio.create_task(callback_worker())
    yield
    # Shutdown: cancelar worker
    worker_task.cancel()
    try:
        await worker_task
    except asyncio.CancelledError:
        pass


app = FastAPI(
    title="CredBridge Pix Service",
    description=(
        "Microserviço Python que adapta e orquestra operações Pix via CorpX v2.14.0. "
        "Gerencia depósitos (QR Code dinâmico), saques (Pix Out) e cobranças futuras "
        "ao sacado de NF-e antecipadas. Notifica a CredBridge via callbacks HMAC-assinados."
    ),
    version="0.1.0",
    lifespan=lifespan,
    # Documentação apenas em não-produção
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restringir em produção para o IP da CredBridge
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(orders_router)
app.include_router(webhooks_router)
app.include_router(collections_router)


@app.get("/health", response_model=HealthResponse, tags=["health"])
async def health_check() -> HealthResponse:
    return HealthResponse(
        status="ok",
        service="credbridge-pix-service",
        version="0.1.0",
    )
