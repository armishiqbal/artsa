"""WebSocket Real-Time Telemetry Route."""

import asyncio
import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from src.api.ws_auth import require_ws_auth
from src.services.telemetry_bus import telemetry_bus

logger = logging.getLogger(__name__)

router = APIRouter(tags=["WebSocket"])


@router.websocket("/websocket")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint streaming live tool calls and containment metrics."""
    if await require_ws_auth(websocket) is None:
        return

    await websocket.accept()
    from src.services.prometheus_metrics import record_ws_connect, record_ws_disconnect

    record_ws_connect()
    queue = await telemetry_bus.subscribe()
    logger.info("WebSocket client connected to live containment feed")

    try:
        # Send recent history on connect
        history = telemetry_bus.get_history(limit=20)
        await websocket.send_text(json.dumps({"type": "history", "events": history}))

        async def receive_loop():
            while True:
                await websocket.receive_text()

        async def send_loop():
            while True:
                event = await queue.get()
                await websocket.send_text(json.dumps({"type": "telemetry", "event": event}))

        receive_task = asyncio.create_task(receive_loop())
        send_task = asyncio.create_task(send_loop())
        done, pending = await asyncio.wait(
            {receive_task, send_task}, return_when=asyncio.FIRST_COMPLETED
        )
        for task in pending:
            task.cancel()
    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected")
    finally:
        record_ws_disconnect()
        telemetry_bus.unsubscribe(queue)
