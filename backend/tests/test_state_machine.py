"""Tests for CampaignStateMachine — FSM transitions."""

import pytest
from src.models import CampaignState
from src.orchestrator.state_machine import CampaignStateMachine


class TestCampaignStateMachine:
    def test_initial_state_is_init(self):
        """Fresh state machine starts in INIT."""
        sm = CampaignStateMachine()
        assert sm.state == CampaignState.INIT

    def test_start_transitions_to_running(self):
        """start() transitions from INIT to RUNNING."""
        sm = CampaignStateMachine()
        sm.start()
        assert sm.state == CampaignState.RUNNING

    def test_pause_from_running(self):
        """pause() transitions from RUNNING to PAUSED."""
        sm = CampaignStateMachine()
        sm.start()
        sm.pause()
        assert sm.state == CampaignState.PAUSED

    def test_resume_from_paused(self):
        """resume() transitions from PAUSED to RUNNING."""
        sm = CampaignStateMachine()
        sm.start()
        sm.pause()
        sm.resume()
        assert sm.state == CampaignState.RUNNING

    def test_complete_from_running(self):
        """complete() transitions from RUNNING to COMPLETED."""
        sm = CampaignStateMachine()
        sm.start()
        sm.complete()
        assert sm.state == CampaignState.COMPLETED

    def test_complete_from_paused(self):
        """complete() transitions from PAUSED to COMPLETED."""
        sm = CampaignStateMachine()
        sm.start()
        sm.pause()
        sm.complete()
        assert sm.state == CampaignState.COMPLETED

    def test_report_from_completed(self):
        """report() transitions from COMPLETED to REPORTED."""
        sm = CampaignStateMachine()
        sm.start()
        sm.complete()
        sm.report()
        assert sm.state == CampaignState.REPORTED

    def test_start_from_running_raises(self):
        """start() from RUNNING raises ValueError."""
        sm = CampaignStateMachine()
        sm.start()
        with pytest.raises(ValueError, match="Cannot start"):
            sm.start()

    def test_pause_from_init_raises(self):
        """pause() from INIT raises ValueError."""
        sm = CampaignStateMachine()
        with pytest.raises(ValueError, match="Cannot pause"):
            sm.pause()

    def test_fail_from_any_state(self):
        """fail() transitions to ERROR from any state."""
        for setup_fn in [
            lambda sm: None,           # INIT
            lambda sm: sm.start(),     # RUNNING
        ]:
            sm = CampaignStateMachine()
            setup_fn(sm)
            sm.fail("test error")
            assert sm.is_error is True

    def test_is_error_property(self):
        """is_error is False initially and True after fail()."""
        sm = CampaignStateMachine()
        assert sm.is_error is False
        sm.fail("boom")
        assert sm.is_error is True
