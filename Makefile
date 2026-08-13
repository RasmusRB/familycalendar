.PHONY: help up down restart build logs ps clean env db-shell

COMPOSE := docker compose

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
