# Production Deployment Guide

## Быстрый старт

```bash
# 1. Собрать фронтенды
bun run build:all

# 2. Собрать Docker образы
bun run prod:build

# 3. Запустить production stack
bun run prod:up

# 4. Настроить SSL (первый раз)
bun run ssl:init your-domain.com your-email@example.com

# 5. Проверить логи
bun run prod:logs
```

## Полный деплой (одной командой)

```bash
bun run prod:deploy
```

Эта команда выполнит:
1. Сборку обоих фронтендов (admin + user)
2. Сборку Docker образов (backend + bot)
3. Запуск всех сервисов

## SSL Сертификаты (Автоматический Certbot в Docker)

### Первоначальная настройка SSL

После первого запуска production stack, получите SSL сертификат:

```bash
# Способ 1: Через npm script
bun run ssl:init your-domain.com your-email@example.com

# Способ 2: Напрямую
bash scripts/init-ssl.sh your-domain.com your-email@example.com
```

Скрипт выполнит:
1. Создание директорий `certs/` и `certbot/www/`
2. Запуск nginx и certbot контейнеров
3. Получение сертификата от Let's Encrypt через webroot
4. Автоматическую перезагрузку nginx

### Автоматическое обновление

Certbot контейнер автоматически проверяет и обновляет сертификаты **дважды в день**.

Принудительное обновление:

```bash
# Способ 1: Через npm script
bun run ssl:renew

# Способ 2: Напрямую
bash scripts/renew-ssl.sh

# Способ 3: Вручную
docker-compose -f docker-compose.prod.yml run --rm certbot renew
docker-compose -f docker-compose.prod.yml exec nginx nginx -s reload
```

### Проверка сертификата

```bash
# Информация о сертификате
docker-compose -f docker-compose.prod.yml exec certbot \
  certbot certificates

# Дата истечения
docker-compose -f docker-compose.prod.yml exec nginx \
  openssl x509 -in /etc/nginx/certs/live/your-domain.com/fullchain.pem -noout -enddate

# Проверка через curl
curl -vI https://your-domain.com 2>&1 | grep -i "expire"
```

### Как это работает

1. **Nginx** слушает порт 80 для ACME challenge (`/.well-known/acme-challenge/`)
2. **Certbot** контейнер использует webroot mode для получения сертификата
3. Сертификаты хранятся в локальной директории `./certs` (монтируется в контейнеры)
4. Nginx использует `server_name _;` (принимает любой домен) и динамический путь к сертификатам
5. Certbot автоматически обновляет сертификаты каждые 12 часов

### Структура директорий

```
certs/                    # Сертификаты Let's Encrypt
├── live/
│   └── your-domain.com/
│       ├── fullchain.pem
│       ├── privkey.pem
│       └── ...
├── archive/
└── renewal/

certbot/                  # ACME challenge
└── www/
    └── .well-known/
        └── acme-challenge/
```

## Структура

### Services

- **postgres** - PostgreSQL база данных (порт 5432)
- **backend** - Elysia API сервер (внутренний порт 3000)
- **bot** - Telegram bot webhook (внутренний порт 3001)
- **nginx** - Reverse proxy + статика (порты 80, 443)
- **certbot** - Автоматическое обновление SSL сертификатов

### Nginx маршруты

- `http://your-domain.com/` → Редирект на HTTPS
- `http://your-domain.com/.well-known/acme-challenge/` → Certbot ACME
- `https://your-domain.com/` → User frontend (статика)
- `https://your-domain.com/admin/` → Admin frontend (статика)
- `https://your-domain.com/api/` → Backend API (proxy)
- `https://your-domain.com/bot` → Bot webhook (proxy)

## Environment Variables

Перед деплоем проверьте `.env`:

```bash
# Production settings
NODE_ENV=production
SENTRY_ENVIRONMENT=production

# Database (Docker service name)
DATABASE_URL=postgresql://user:password@postgres:5432/dbname

# Backend
JWT_SECRET=<your-secret>
TELEGRAM_BOT_TOKEN=<your-token>

# Bot
TELEGRAM_WEBHOOK_URL=https://your-domain.com/bot

# Sentry (optional)
SENTRY_DSN=<your-dsn>
```

## Управление

### Просмотр статуса

```bash
docker ps
```

### Логи

```bash
# Все сервисы
bun run prod:logs

# Конкретный сервис
docker logs backend
docker logs bot
docker logs nginx
docker logs certbot
docker logs postgres
```

### Остановка

```bash
bun run prod:down
```

### Перезапуск после изменений

```bash
# Пересобрать фронтенды
bun run build:all

# Пересобрать Docker образы
bun run prod:build

# Перезапустить сервисы
docker-compose -f docker-compose.prod.yml up -d --force-recreate
```

## Database Migrations

Применить миграции в production:

```bash
docker exec -it backend bun run prisma:migrate
```

Открыть Prisma Studio:

```bash
docker exec -it backend bun run prisma:studio
```

## Troubleshooting

### Backend не запускается

Проверьте что сертификаты TLS существуют:

```bash
docker-compose -f docker-compose.prod.yml exec nginx ls -la /etc/nginx/certs/live/
```

Если сертификатов нет, запустите:

```bash
bun run ssl:init your-domain.com your-email@example.com
```

### Nginx 502 Bad Gateway

Проверьте что backend и bot запущены:

```bash
docker ps | grep -E "backend|bot"
```

Проверьте логи:

```bash
docker logs backend
docker logs bot
```

### База данных недоступна

Проверьте что postgres запущен и healthy:

```bash
docker ps | grep postgres
docker logs postgres
```

### Фронтенд показывает 404

Проверьте что dist директории существуют:

```bash
ls -la apps/frontend/admin/dist/
ls -la apps/frontend/user/dist/
```

Если нет, пересоберите:

```bash
bun run build:all
```

### Certbot ошибки

**Certificate validation failed:**
```bash
# Проверить что порт 80 доступен извне
curl http://your-domain.com/.well-known/acme-challenge/test

# Проверить логи certbot
docker logs certbot
```

**DNS не резолвится:**
```bash
# Проверить DNS
nslookup your-domain.com

# Убедиться что домен указывает на ваш сервер
```

**Rate limit exceeded:**
```bash
# Let's Encrypt имеет лимиты (5 сертификатов в неделю на домен)
# Используйте staging для тестов:
docker-compose -f docker-compose.prod.yml run --rm certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --staging \
  -d your-domain.com
```

### Nginx не перезагружается после обновления сертификата

```bash
# Перезагрузить nginx
docker-compose -f docker-compose.prod.yml exec nginx nginx -s reload

# Или перезапустить контейнер
docker-compose -f docker-compose.prod.yml restart nginx
```

## Development vs Production

### Development (текущая конфигурация)

```bash
# Запуск dev серверов
bun run dev:all

# Nginx проксирует на Vite dev серверы
docker-compose up -d nginx
```

Использует:
- `docker-compose.yml`
- `nginx/nginx.conf`
- Vite dev серверы с HMR
- Self-signed сертификаты

### Production

```bash
# Сборка и деплой
bun run prod:deploy

# Настройка SSL (первый раз)
bun run ssl:init your-domain.com your-email@example.com
```

Использует:
- `docker-compose.prod.yml`
- `nginx/nginx.prod.conf`
- Статические билды фронтендов
- Docker контейнеры для backend/bot
- Let's Encrypt сертификаты (автообновление)

## Мониторинг

### Проверка здоровья сервисов

```bash
# Backend API
curl -k https://localhost:3000/api/health

# Bot webhook
curl https://your-domain.com/bot

# User frontend
curl https://your-domain.com/

# Admin frontend
curl https://your-domain.com/admin/
```

### Использование ресурсов

```bash
docker stats
```

### Проверка SSL сертификата

```bash
# Информация о сертификате
docker-compose -f docker-compose.prod.yml exec certbot certbot certificates

# Тест SSL конфигурации
curl -vI https://your-domain.com 2>&1 | grep -E "SSL|TLS"

# Проверка через openssl
openssl s_client -connect your-domain.com:443 -servername your-domain.com
```

## Backup

### Database backup

```bash
docker exec postgres pg_dump -U user dbname > backup.sql
```

### Database restore

```bash
docker exec -i postgres psql -U user dbname < backup.sql
```

### Backup сертификатов

```bash
# Создать backup
tar -czf certs-backup-$(date +%Y%m%d).tar.gz certs/

# Восстановить
tar -xzf certs-backup-20260310.tar.gz
```

## Полный процесс деплоя с нуля

```bash
# 1. Клонировать репозиторий
git clone <repo-url>
cd jahonbozor

# 2. Настроить .env
cp .env.example .env
# Отредактировать .env

# 3. Собрать фронтенды
bun install
bun run build:all

# 4. Запустить production stack
bun run prod:deploy

# 5. Настроить SSL
bun run ssl:init your-domain.com your-email@example.com

# 6. Применить миграции
docker exec -it backend bun run prisma:migrate

# 7. Проверить
curl https://your-domain.com
curl https://your-domain.com/admin/

# 8. Готово!
```
