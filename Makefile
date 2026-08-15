.PHONY: help up down restart build logs ps clean env db-shell dev dev-db dev-api dev-web

COMPOSE := docker compose

# `dev` needs bash's `wait -n` to notice when either server exits.
SHELL := /bin/bash

# Local development runs the frontend (Vite, :5173) and backend (:4000) on the host,
# with only the Postgres container from docker-compose.yml behind them. That container
# publishes 5432 on the host as 15432, and its password comes from .env — so the
# backend's built-in DATABASE_URL default doesn't fit and has to be overridden here.
DEV_DB_PASSWORD = $(shell grep -E '^POSTGRES_PASSWORD=' .env | cut -d= -f2-)
DEV_DB_URL = postgres://familycalendar:$(DEV_DB_PASSWORD)@localhost:15432/familycalendar?sslmode=disable

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2}'

env: ## Create .env from .env.example if it doesn't exist yet
	@test -f .env || (cp .env.example .env && echo "Created .env — edit it before running 'make up'.")

up: env ## Build and start the app in the background
	$(COMPOSE) up -d --build

down: ## Stop and remove the containers
	$(COMPOSE) down

restart: ## Restart all services
	$(COMPOSE) restart

build: ## Rebuild the images without starting
	$(COMPOSE) build

logs: ## Follow logs from all services
	$(COMPOSE) logs -f

ps: ## Show running services
	$(COMPOSE) ps

clean: ## Stop containers and remove volumes (deletes the local database!)
	$(COMPOSE) down -v

db-shell: ## Open a psql shell into the running Postgres container
	$(COMPOSE) exec postgres psql -U familycalendar -d familycalendar

dev: dev-db ## Run the app locally on http://localhost:5173 (Ctrl-C stops both servers)
	@test -d frontend/node_modules || (cd frontend && npm install)
	@echo ""
	@echo "  frontend  http://localhost:5173"
	@echo "  backend   http://localhost:4000"
	@echo ""
	@trap 'kill 0' EXIT INT TERM; \
	(cd backend && DATABASE_URL='$(DEV_DB_URL)' go run ./cmd/server) & \
	(cd frontend && npm run dev) & \
	wait -n

dev-db: env ## Start only the Postgres container (for local development)
	$(COMPOSE) up -d postgres
	@echo "Waiting for Postgres..."
	@until $(COMPOSE) exec -T postgres pg_isready -U familycalendar -d familycalendar >/dev/null 2>&1; do sleep 1; done

dev-api: dev-db ## Run just the Go backend on :4000
	cd backend && DATABASE_URL='$(DEV_DB_URL)' go run ./cmd/server

dev-web: ## Run just the Vite dev server on :5173
	cd frontend && npm run dev
