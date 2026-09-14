"""GitHub Webhook Receiver and Replay Deduplicator."""

from __future__ import annotations

import hashlib
import hmac
import logging
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from fastapi.responses import JSONResponse

from src.api.dependencies import get_redis
from src.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/github", tags=["GitHub Webhooks"])


@router.post("/webhooks")
async def github_webhook_receiver(
    request: Request,
    x_hub_signature_256: str | None = Header(None, alias="X-Hub-Signature-256"),
    x_github_delivery: str | None = Header(None, alias="X-GitHub-Delivery"),
    x_github_event: str | None = Header(None, alias="X-GitHub-Event"),
    redis: Any = Depends(get_redis),
):
    """Receive and deduplicate GitHub webhook events.

    - Verifies HMAC-SHA256 signature with GITHUB_WEBHOOK_SECRET.
    - Deduplicates delivery using X-GitHub-Delivery GUID in Redis (24h TTL).
    - Returns 200 with status 'ignored_replay' on duplicate deliveries.
    """
    raw_body = await request.body()

    # 1. Verify HMAC signature if secret is configured or header is present
    secret = settings.GITHUB_WEBHOOK_SECRET
    if not secret and (settings.ENVIRONMENT == "production" or settings.auth_required):
        logger.error("GITHUB_WEBHOOK_SECRET is not configured in production")
        raise HTTPException(status_code=500, detail="Webhook secret not configured")

    if secret:
        if not x_hub_signature_256:
            logger.warning("Missing X-Hub-Signature-256 header")
            raise HTTPException(status_code=401, detail="Missing signature header")

        expected_sig = "sha256=" + hmac.new(
            secret.encode("utf-8"),
            raw_body,
            hashlib.sha256,
        ).hexdigest()

        if not hmac.compare_digest(expected_sig, x_hub_signature_256):
            logger.warning("Invalid X-Hub-Signature-256 signature")
            raise HTTPException(status_code=401, detail="Invalid webhook signature")

    # 2. Check X-GitHub-Delivery GUID
    if not x_github_delivery:
        logger.warning("Missing X-GitHub-Delivery header")
        raise HTTPException(status_code=400, detail="Missing X-GitHub-Delivery header")

    # 3. Deduplicate delivery via Redis SET NX with 24h (86400s) TTL
    key = f"artsa:github:webhook:delivery:{x_github_delivery}"
    try:
        is_new = redis.set_nx(key, "1", ttl_sec=86400)
    except Exception as exc:
        logger.error("Redis deduplication failed for delivery %s: %s", x_github_delivery, exc)
        raise HTTPException(status_code=503, detail="Webhook deduplication store unavailable")

    if not is_new:
        logger.info("Deduplicated replay webhook delivery: %s", x_github_delivery)
        return JSONResponse(
            status_code=200,
            content={
                "status": "ignored_replay",
                "message": "Ignored/deduplicated",
                "delivery_id": x_github_delivery,
            },
        )

    # 4. New delivery successfully received
    event_type = x_github_event or "ping"
    logger.info("Processed GitHub webhook event '%s' delivery: %s", event_type, x_github_delivery)

    return JSONResponse(
        status_code=200,
        content={
            "status": "processed",
            "message": "Processed successfully",
            "delivery_id": x_github_delivery,
            "event": event_type,
        },
    )
