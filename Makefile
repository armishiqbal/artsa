.PHONY: help dev build test lint clean docker-up docker-down demo demo-list

help:
	@echo "ARTSA Platform Development Commands:"
	@echo "  make dev          Start backend API and Next.js frontend concurrently"
	@echo "  make test         Run backend pytest test suite"
	@echo "  make lint         Run ruff linting on backend"
	@echo "  make demo         Run the one-command attack demo (default: prompt_injection)"
	@echo "  make demo CLASS=reverse_shell   Run a specific attack-class demo"
	@echo "  make demo-list    List all demo attack classes"
	@echo "  make docker-up    Start Postgres, Redis, Backend, and Frontend via Docker Compose"
	@echo "  make docker-down  Stop Docker Compose services"

dev:
	npm run dev

test:
	cd backend && ../backend/.venv/bin/python -m pytest tests/ -v

lint:
	cd backend && ../backend/.venv/bin/python -m ruff check src/ tests/

# Phase 5.2: one-command per-attack-class demos.
CLASS ?= prompt_injection
demo:
	cd backend && PYTHONPATH=. ../backend/.venv/bin/python scripts/demo.py --class $(CLASS)

demo-list:
	cd backend && PYTHONPATH=. ../backend/.venv/bin/python scripts/demo.py --list

docker-up:
	docker-compose up -d --build

docker-down:
	docker-compose down -v

clean:
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -type d -name ".pytest_cache" -exec rm -rf {} +
	find . -type d -name ".next" -exec rm -rf {} +
