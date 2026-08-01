"""ARTSA — Adversarial Red Team Simulation Architecture."""

import logging
import os

__version__ = "0.2.0"


def _setup_logging() -> None:
    """Configure root logging for the ARTSA package."""
    level_name = os.environ.get("ARTSA_LOG_LEVEL", "INFO").upper()
    level = getattr(logging, level_name, logging.INFO)

    handler = logging.StreamHandler()
    handler.setFormatter(
        logging.Formatter(
            "[%(asctime)s] %(levelname)-8s %(name)s — %(message)s",
            datefmt="%H:%M:%S",
        )
    )

    root = logging.getLogger("src")
    root.setLevel(level)
    if not root.handlers:
        root.addHandler(handler)


_setup_logging()
