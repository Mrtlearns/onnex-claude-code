COMPOSE = docker compose -f docker-compose.yml --env-file env/.env
SERVICE ?=

.PHONY: up down logs restart status pull clean

up:
	$(COMPOSE) up -d $(SERVICE)

down:
	$(COMPOSE) down $(SERVICE)

logs:
	$(COMPOSE) logs -f $(SERVICE)

restart:
	$(COMPOSE) restart $(SERVICE)

status:
	$(COMPOSE) ps

pull:
	$(COMPOSE) pull $(SERVICE)

clean:
	$(COMPOSE) down -v --remove-orphans
