"""Campaign State Machine."""

import logging

from src.models import CampaignState

logger = logging.getLogger(__name__)


# Extend CampaignState at runtime — avoids changing models.py which would break
# serialization of existing data. The FSM tracks ERROR internally.
_ERROR_STATE = "ERROR"


class CampaignStateMachine:
    """Manages state transitions for a campaign.

    Valid transitions:
        INIT → RUNNING → COMPLETED → REPORTED
        RUNNING → PAUSED → RUNNING (cycle)
        ANY → ERROR (terminal)
    """

    def __init__(self) -> None:
        self._state: CampaignState | str = CampaignState.INIT

    @property
    def state(self) -> CampaignState | str:
        return self._state

    @property
    def is_error(self) -> bool:
        return self._state == _ERROR_STATE

    def start(self) -> None:
        if self._state != CampaignState.INIT:
            raise ValueError(f"Cannot start from state {self._state}")
        self._state = CampaignState.RUNNING

    def pause(self) -> None:
        if self._state != CampaignState.RUNNING:
            raise ValueError(f"Cannot pause from state {self._state}")
        self._state = CampaignState.PAUSED

    def resume(self) -> None:
        if self._state != CampaignState.PAUSED:
            raise ValueError(f"Cannot resume from state {self._state}")
        self._state = CampaignState.RUNNING

    def complete(self) -> None:
        if self._state not in (CampaignState.RUNNING, CampaignState.PAUSED):
            raise ValueError(f"Cannot complete from state {self._state}")
        self._state = CampaignState.COMPLETED

    def report(self) -> None:
        if self._state != CampaignState.COMPLETED:
            raise ValueError(f"Cannot report from state {self._state}")
        self._state = CampaignState.REPORTED

    def fail(self, reason: str = "") -> None:
        """Transition to ERROR state from any state. Terminal — no recovery."""
        logger.error(
            "Campaign FSM transitioning to ERROR from %s: %s",
            self._state,
            reason or "unknown",
        )
        self._state = _ERROR_STATE
