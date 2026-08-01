"""WebSocket Real-Time Telemetry Route."""

import json
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)

router = APIRouter(tags=["WebSocket"])


@router.websocket("/websocket")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint streaming live tool calls and containment metrics."""
    await websocket.accept()
    logger.info("WebSocket client connected to live containment feed")

    try:
        while True:
            data = await websocket.receive_text()
            logger.info("Received WebSocket message: %s", data)
            # Echo back acknowledgement
            await websocket.send_text(json.dumps({"status": "ACK", "message": "Telemetry stream active"}))
    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected")
