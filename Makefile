.PHONY: help up down restart logs ps test test-unit test-integration lint seed clean

help:
	@echo "Zena Real-Time Chat Management"
	@echo "  make up          - Start all services (3 gateway nodes, mongo rs0, redis, nginx, web)"
	@echo "  make down        - Stop all services"
	@echo "  make test        - Run unit and integration tests"
	@echo "  make seed        - Seed database with sample conversations and users"
	@echo "  make logs        - Tail logs from all containers"

up:
	docker compose -f docker/compose.yaml up -d --build

down:
	docker compose -f docker/compose.yaml down

restart:
	docker compose -f docker/compose.yaml restart

logs:
	docker compose -f docker/compose.yaml logs -f

ps:
	docker compose -f docker/compose.yaml ps

test: test-unit test-integration

test-unit:
	cd server && npm run test:unit

test-integration:
	cd server && npm run test:integration

lint:
	npm run lint

seed:
	node scripts/seed.js

clean:
	docker compose -f docker/compose.yaml down -v
