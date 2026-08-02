"""Webhook dispatcher tests."""

import uuid
from unittest.mock import MagicMock, patch

from src.core.models.alerts import Alert, AlertRule
from src.services import alert_store
from src.services.webhook_dispatcher import dispatch_alert_webhooks


def test_webhook_dispatch_success():
    alert_store._webhook_rules.clear()
    alert_store.add_webhook_rule(
        AlertRule(
            id="rule-1",
            tenant_id="default",
            risk_threshold=50.0,
            channel="WEBHOOK",
            target_url="https://example.com/hook",
            enabled=True,
        )
    )

    alert = Alert(
        id=uuid.uuid4(),
        session_id=uuid.uuid4(),
        agent_id="agent-1",
        severity="HIGH",
        title="Test",
        message="Agent agent-1 · risk 85.0 · recommended KILL",
        channel="WEBHOOK",
        delivered=False,
    )

    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()

    with patch("src.services.webhook_dispatcher.httpx.Client") as mock_client:
        mock_client.return_value.__enter__.return_value.post.return_value = mock_response
        delivered = dispatch_alert_webhooks(alert)

    assert delivered is True
