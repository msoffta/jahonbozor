# CLAUDE.md

Guidance for Claude Code when working with this repository.

## Обязательные правила

1. **Test First** — сначала пишем/обновляем тесты, затем код:
   - При создании модуля: сначала тесты service → затем service → затем тесты index → затем index
   - При ревью модуля: сначала проверяем наличие и качество тестов
   - При изменении модуля: сначала обновляем тесты для нового поведения
2. **Verify After Every Action** — после каждого действия (создание/изменение файлов, миграции, генерация) запускать:
   - `bun run typecheck` — проверка типов
   - `bun run test` — прогон тестов
3. **Context7 MCP** — всегда использовать Context7 MCP для получения документации библиотек/API, генерации кода, шагов настройки и конфигурации, без необходимости явного запроса от пользователя
4. **Unit тесты** — при создании/изменении модуля писать оба типа тестов:
   - `{domain}.service.test.ts` — тесты бизнес-логики
   - `{domain}.index.test.ts` — тесты эндпоинтов
   - Каждый метод должен быть покрыт **всеми сценариями**: happy path, edge cases (id=0, negative id, empty list, empty body), boundary values (exact stock, quantity+1), error cases (not found, deleted record, duplicate, constraint violation). См. [docs/testing.md](docs/testing.md#test-coverage-requirements)
5. **Документация** — при ключевых изменениях обновлять:
   - `CLAUDE.md` — новые модули, API, конфигурации, зависимости
   - `docs/rules.md` — изменения паттернов, конвенций, best practices
6. **AHA (Avoid Hasty Abstractions) + Rule of Three** — дублирование допустимо до 2 раз. На третьем повторении — абстрагировать. Не создавать абстракции «на будущее», только когда паттерн повторился 3+ раза и стал очевидным
7. **Интерактивность** — все фронтенд-приложения должны быть интерактивными и приятными: `PageTransition` на каждой странице, `whileTap` на кнопках, `AnimatePresence` для conditional renders, spring-анимации, правильные типы курсора (pointer/text/not-allowed — задано глобально). См. [docs/frontend.md](docs/frontend.md#animation-motion)
8. **Размер CLAUDE.md** — файл не должен превышать 40,000 символов. При добавлении нового контента, если лимит превышен, выносить детали в `docs/` и оставлять ссылку

## Runtime & Package Manager

**Bun** — единственный runtime и package manager в проекте.

- **НЕ использовать:** Node.js, npm, yarn, pnpm
- **Использовать:** `bun`, `bun run`, `bun test`, `bun install`

## Environment

Единый `.env` файл в **корне монорепо**. Фронтенды получают переменные через Vite `envDir`.

> **Все команды запускать из корня** через root `package.json`.

### Делегирование скриптов

Root `package.json` — чистое делегирование без env:
```
"dev": "bun run --cwd apps/backend dev"
```

Workspace-скрипты сами резолвят env:
```
"dev": "bun --env-file=../../.env run --watch src/index.ts"
```

`--env-file` резолвится относительно `--cwd`, поэтому workspace-скрипты используют `../../.env` (путь от `apps/backend` к корню).

## Quick Reference

### Backend
```bash
bun install                # Install dependencies
bun run dev                # Run backend (port 3000)
bun run test               # Run unit tests
bun run test:watch         # Watch mode
bun run test:coverage      # With coverage
bun run prisma:generate    # Generate Prisma client
bun run prisma:migrate     # Create and apply migrations
bun run prisma:studio      # Open Prisma Studio GUI
bun run db:up / db:down    # Start/stop PostgreSQL via Docker
```

### Bot
```bash
bun run dev:bot            # Run bot (port 3001)
bun run test:bot           # Run bot tests
```

### Frontend
```bash
bun run dev:admin          # Run admin panel (port 5173)
bun run dev:user           # Run user app (port 5174)
bun run build:admin        # Build admin for production
bun run build:user         # Build user app for production
```

## Architecture

### Monorepo Structure
```
apps/
├── backend/               # Elysia + Prisma + Bun
├── bot/                   # Telegram bot (grammy + Prisma + Bun)
└── frontend/
    ├── admin/             # Admin panel (Vite + React 19)
    └── user/              # User-facing app (Vite + React 19)
packages/
├── schemas/               # Zod validation schemas (shared)
├── logger/                # Winston logger factory
├── ui/                    # Shared UI components (shadcn/ui + Tailwind)
└── utils/                 # Shared utilities
```

> **Workspace config:** root `package.json` workspaces must list all apps explicitly:
> `["apps/backend", "apps/bot", "apps/frontend/admin", "apps/frontend/user", "packages/*"]`

### Path Aliases

Backend uses `@backend/` prefix to avoid collisions with frontend's `@/` alias:

```
Backend tsconfig:  @backend/lib/*, @backend/api/*, @backend/generated/*, @backend/test/*
Bot tsconfig:      @bot/* (own src) + @backend/generated/*
Frontend tsconfig: @/* (own src) + @backend/lib/*, @backend/api/*, @backend/generated/*
```

> Frontend tsconfigs must include backend aliases for Eden Treaty type resolution. See [docs/frontend.md](docs/frontend.md#eden-treaty-type-resolution).

## Detailed Documentation

| Document | Contents |
|----------|----------|
| [docs/backend.md](docs/backend.md) | Backend organization, route prefixes, Elysia error handling (status(), onError, guard scoping), permissions, categories, response pattern, request context, logging, audit logging, enums, TypeScript rules, HTTP status codes, soft delete, transactions, environment variables, database |
| [docs/testing.md](docs/testing.md) | Backend unit testing: commands, test structure, Bun mocking, Prisma mocks, mock isolation, Elysia endpoint tests, error response testing, AAA pattern, coverage requirements, best practices |
| [docs/frontend.md](docs/frontend.md) | Frontend architecture (admin + user apps), tech stack, routing, state management, API layer (Eden), forms, i18n, shared UI package, auth flow, Sentry integration, conventions |
| [docs/frontend-testing.md](docs/frontend-testing.md) | Frontend testing: Zustand stores, hooks (renderHook), component testing, mocking patterns (Router/Query/Eden/Motion/i18n/Sentry/fetch), mock.module ordering, Testing Library query priority, coverage requirements |
| [docs/bot.md](docs/bot.md) | Telegram bot: architecture, auth flow, phone verification, handlers, services, testing, environment variables |
| [docs/rules.md](docs/rules.md) | Condensed code conventions quick reference (backend + frontend), Zod 4 patterns |

## Monitoring

**Sentry** — error tracking and performance monitoring.
- Backend: `elysiajs-sentry` plugin (conditional on `SENTRY_DSN` env)
- Frontend: `@sentry/react` with user context on auth events (login → setUser, logout → clear)
- Request tracing: `requestId` tagged on every backend request via `Sentry.getCurrentScope().setTag()`
