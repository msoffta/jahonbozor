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
- **Использовать:** `bun`, `bun run`, `bun install`

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

### Test Runner

**Vitest** — единственный тест-раннер для всех workspace.

- Конфигурация: `vitest.config.ts` в каждом workspace
- Моки: `vi.mock()` (hoisted автоматически), `vi.fn()`, `vi.spyOn()`
- Prisma: `vitest-mock-extended` + `mockDeep<PrismaClient>()`
- DOM: happy-dom через `environment: 'happy-dom'` в vitest.config.ts
- Mock isolation: per-file (vi.mock() в файле A не влияет на файл B)

### Linting & Formatting

```bash
bun run lint               # ESLint check (all workspaces)
bun run lint:fix           # ESLint auto-fix
bun run format             # Prettier format all files
bun run format:check       # Check formatting (CI)
```

- Единый `eslint.config.js` в корне — flat config для всего монорепо
- `.prettierrc.json` в корне — Prettier для форматирования
- Pre-commit hook (`simple-git-hooks` + `lint-staged`) — автоматически lint + format staged файлов
- Commit-msg hook (`commitlint`) — валидация conventional commits
- Подробности правил: [docs/rules.md](docs/rules.md#linting--formatting)

### Versioning & Commits

#### Как делать коммиты

1. **Staged файлы** → pre-commit hook автоматически прогонит `lint-staged` (ESLint --fix + Prettier)
2. **Commit message** → commit-msg hook валидирует через `commitlint` (conventional commits)
3. **Changeset** (если есть user/dev-facing изменения) → создать перед коммитом

#### Формат коммитов (Conventional Commits)

```
<type>(<scope>): <description>

[optional body]
```

**Types:** `feat`, `fix`, `chore`, `refactor`, `docs`, `test`, `perf`, `ci`, `build`, `style`, `revert`
**Scopes (обязательный):** `backend`, `bot`, `admin`, `user`, `ui`, `schemas`, `logger`, `utils`, `ci`, `deps`
**Мульти-scope:** при изменениях в нескольких workspace — `feat(backend,admin): ...`

Примеры:

```
feat(backend): add product categories API
fix(ui): correct DataTable sorting on empty values
chore(deps): update vitest to v3.2
refactor(admin,user): extract shared auth hook
```

#### Changeset workflow

```bash
bun run changeset          # Создать changeset файл (.changeset/*.md)
bun run version-packages   # Bump versions + CHANGELOG (CI only)
```

- **Когда нужен changeset:** любой PR с user/dev-facing изменениями (feat, fix, perf)
- **Когда НЕ нужен:** chore, docs, test, ci, refactor (внутренние изменения)
- **Fixed versioning** — все workspace получают одинаковую версию
- **Release flow:** merge PR → `release.yml` создаёт "Version Packages" PR → merge → deploy с semver тегами

#### Git hooks (автоматические)

| Hook         | Что делает                                               |
| ------------ | -------------------------------------------------------- |
| `pre-commit` | `lint-staged` — ESLint --fix + Prettier на staged файлах |
| `commit-msg` | `commitlint` — валидация формата conventional commit     |

> **Важно:** НЕ пропускать hooks (`--no-verify`). Если hook падает — исправить причину, не обходить.

- Подробности: [docs/rules.md](docs/rules.md#versioning--commits)

### Testing

```bash
bun run test               # Run all tests (vitest across all workspaces)
bun run test:ui            # Run UI package tests
bun run test:backend       # Run backend tests only
bun run test:bot           # Run bot tests only
bun run test:user          # Run user frontend tests only
bun run test:admin         # Run admin frontend tests only
bun run test:watch         # Watch mode
bun run test:coverage      # With coverage
bun run typecheck          # TypeScript check (backend + bot + ui + admin + user)
```

### Backend

```bash
bun install                # Install dependencies
bun run dev                # Run backend (port 3000)
bun run prisma:generate    # Generate Prisma client
bun run prisma:migrate     # Create and apply migrations
bun run prisma:studio      # Open Prisma Studio GUI
bun run db:up / db:down    # Start/stop PostgreSQL via Docker
```

### Bot

```bash
bun run dev:bot            # Run bot (port 3001)
```

### Frontend

```bash
bun run dev:admin          # Run admin panel (port 5173)
bun run dev:user           # Run user app (port 5174)
bun run build:admin        # Build admin for production
bun run build:user         # Build user app for production
bun run build:all          # Build both frontend apps
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
├── ui/                    # Shared UI components (shadcn/ui + Tailwind) + tests
└── utils/                 # Shared utilities
```

> **UI Package Testing:** `packages/ui` содержит тесты для shared компонентов (DataTable - 45 tests). Тесты используют Vitest + happy-dom, реальные компоненты и `userEvent` для взаимодействий. См. [docs/frontend-testing.md#ui-package-testing](docs/frontend-testing.md#ui-package-testing-packagesui).

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

| Document                                             | Contents                                                                                                                                                                                                                                                                                   |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [docs/backend.md](docs/backend.md)                   | Backend organization, route prefixes, Elysia error handling (status(), onError, guard scoping), permissions, categories, response pattern, request context, logging, audit logging, enums, TypeScript rules, HTTP status codes, soft delete, transactions, environment variables, database |
| [docs/testing.md](docs/testing.md)                   | Backend unit testing: commands, test structure, Vitest mocking, Prisma mockDeep, Elysia endpoint tests, error response testing, AAA pattern, coverage requirements, best practices                                                                                                         |
| [docs/frontend.md](docs/frontend.md)                 | Frontend architecture (admin + user apps), tech stack, routing, state management, API layer (Eden), forms, i18n, shared UI package, auth flow, Sentry integration, conventions                                                                                                             |
| [docs/frontend-testing.md](docs/frontend-testing.md) | Frontend testing: Zustand stores, hooks (renderHook), component testing, Vitest mocking patterns (Router/Query/Eden/Motion/i18n/Sentry/fetch), Testing Library query priority, coverage requirements                                                                                       |
| [docs/bot.md](docs/bot.md)                           | Telegram bot: architecture, auth flow, phone verification, handlers, services, testing, environment variables                                                                                                                                                                              |
| [docs/rules.md](docs/rules.md)                       | Condensed code conventions quick reference (backend + frontend), Zod 4 patterns                                                                                                                                                                                                            |

## CI/CD

**GitHub Actions** — automated testing, building, and deployment.

### Pipeline Overview

- **Trigger:** Push to main branch or pull request
- **Jobs:** Install → [Lint/TypeCheck, Test Backend, Test Bot, Test Frontend Admin, Test Frontend User] → Build Images → Deploy
- **Duration:** ~14 minutes from push to production

### Workflow

1. **Install:** Setup Bun, install dependencies, cache for parallel jobs
2. **Lint & Type Check:** TypeScript compilation check for all workspaces
3. **Tests:** Parallel execution of backend, bot, and frontend tests
4. **Build Images:** Build and push Docker images to GitHub Container Registry (ghcr.io)
5. **Deploy:** SSH to VPS, pull images, restart containers, verify health

### GitHub Secrets Required

**VPS Access:**

- `VPS_HOST` — Server IP or domain
- `VPS_USER` — SSH user (e.g., `deploy`)
- `VPS_SSH_KEY` — Private SSH key
- `VPS_DEPLOY_PATH` — Deployment directory (e.g., `/opt/jahonbozor`)

**Application Environment:**

- `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_NAME`
- `JWT_SECRET`
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_URL`
- `SENTRY_DSN`, `SENTRY_ENVIRONMENT` (optional)
- `VITE_TELEGRAM_BOT_USERNAME`

**Notifications (optional):**

- `TELEGRAM_CHAT_ID`, `TELEGRAM_NOTIFICATION_TOKEN`

### Deployment

- **Strategy:** Pull pre-built images from ghcr.io, restart containers
- **Health Checks:** Verify backend and bot endpoints after deployment
- **Rollback:** Automatic rollback on health check failure
- **Tracking:** Last successful deployment SHA saved for rollback

### Manual Operations

```bash
# Deploy manually (on VPS)
cd /opt/jahonbozor
./deploy.sh

# Rollback to previous version
./rollback.sh

# View logs
docker compose -f docker-compose.prod.yml logs -f
```

## Monitoring

**Sentry** — error tracking and performance monitoring.

- Backend: `elysiajs-sentry` plugin (conditional on `SENTRY_DSN` env)
- Frontend: `@sentry/react` with user context on auth events (login → setUser, logout → clear)
- Request tracing: `requestId` tagged on every backend request via `Sentry.getCurrentScope().setTag()`
