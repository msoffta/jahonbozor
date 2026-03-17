# Bot — Telegram Bot

Telegram bot for user phone number verification. Runs as a webhook server on grammy.

## Architecture

```
apps/bot/
├── src/
│   ├── index.ts                    # Entry point — Bun.serve() + webhook registration
│   ├── bot.ts                      # grammy Bot instance + /start and message handlers
│   ├── handlers/
│   │   └── contact.handler.ts      # Contact sharing handler
│   ├── services/
│   │   ├── phone.service.ts        # Phone persistence
│   │   └── user.service.ts         # User info lookup (language, phone)
│   └── lib/
│       ├── prisma.ts               # Prisma client (shared schema from backend)
│       ├── logger.ts               # Winston logger (named export)
│       ├── messages.ts             # i18n messages (uz/ru) for bot and contact handler
│       └── phone-validation.ts     # Phone format validation and normalization
├── test/
│   ├── setup.ts                    # Test setup + Prisma mockDeep + mock factories
│   └── __tests__/
│       ├── bot.test.ts             # Bot instance + handler tests
│       ├── bot.index.test.ts       # Webhook server + health check + shutdown tests
│       ├── contact.handler.test.ts # Contact handler tests
│       ├── phone.service.test.ts   # Phone service tests
│       ├── phone-validation.test.ts # Validation tests
│       └── user.service.test.ts    # User service tests
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## Auth Flow

Full Telegram authentication cycle with phone verification:

```
1. Frontend: user clicks "Login with Telegram"
2. Frontend → Backend: POST /api/public/users/telegram (widget data + language)
3. Backend:
   - Validates HMAC-SHA256 hash using TELEGRAM_BOT_TOKEN
   - Creates/updates user in DB (transaction + audit log)
   - Generates JWT (access + refresh)
   - If no phone: sendContactRequest() → Telegram API
4. Bot: receives webhook with contact event
5. Bot: validates → normalizes → saves to DB
6. Bot: sends success/error message
```

**Backend integration:** `apps/backend/src/lib/telegram.ts` — `sendContactRequest()` calls Telegram API directly (fire-and-forget, does not block auth response).

## Handlers

### `/start` command

- Checks if user already has a phone in DB
- If phone exists — "Phone already saved" message
- If not — message + "Share phone number" keyboard button

### `message:contact`

1. Validates `contact.user_id === ctx.from.id` (own contact, not someone else's)
2. Validates phone format (10-15 digits)
3. Normalizes number (adds `+` prefix)
4. Calls `savePhone(telegramId, phone, logger)`
5. Sends localized result message

### Generic `message`

- If phone exists — "Phone already saved"
- If not — re-shows "Share phone number" button

## Phone Service

```typescript
savePhone(telegramId: string, phone: string, logger: Logger): Promise<PhoneResult>
```

**PhoneResult:**

- `{ success: true }` — phone saved
- `{ success: false, error: "USER_NOT_FOUND" }` — user not found by telegramId
- `{ success: false, error: "ALREADY_HAS_PHONE" }` — user already has a phone
- `{ success: false, error: "PHONE_TAKEN" }` — phone linked to another account
- `{ success: false, error: "DB_ERROR" }` — database error

## Phone Validation

```typescript
validatePhone(phone: string): boolean
// 10-15 digits after stripping non-numeric characters
// Accepts: +998901234567, 998901234567, +1 (234) 567-8900

normalizePhone(phone: string): string
// Strips spaces, dashes, parentheses; adds "+" if missing
// "998901234567" → "+998901234567"
```

## i18n

All bot messages are available in two languages: **uz** (Uzbek, default) and **ru** (Russian). Language is determined from the user's `language` field in DB. Falls back to uz on lookup failure.

## Environment Variables

| Variable                  | Required | Default | Description                                                                      |
| ------------------------- | -------- | ------- | -------------------------------------------------------------------------------- |
| `TELEGRAM_BOT_TOKEN`      | Yes      | —       | Bot token from @BotFather                                                        |
| `TELEGRAM_WEBHOOK_URL`    | Yes      | —       | Full webhook URL (e.g. `https://domain.com/bot`)                                 |
| `TELEGRAM_WEBHOOK_SECRET` | No       | —       | Secret token for webhook verification (`X-Telegram-Bot-Api-Secret-Token` header) |
| `BOT_PORT`                | No       | 3001    | Bot HTTP server port                                                             |
| `DATABASE_URL`            | Yes      | —       | PostgreSQL connection string                                                     |

## Path Aliases

```json
{
    "@bot/*": ["./src/*"],
    "@backend/generated/*": ["../backend/src/generated/*"]
}
```

Bot uses the Prisma client from backend (`@backend/generated/prisma/client`) but has its own instance with `@prisma/adapter-pg`.

## Testing

Run tests via `bun run test:bot` from the monorepo root.

**Mocking patterns:**

- Prisma: `mockDeep<PrismaClient>()` via `vitest-mock-extended` in `test/setup.ts`
- Logger: `vi.mock("@bot/lib/logger")` with `{ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }`
- grammy Context: object with `message`, `from`, `reply` (`vi.fn()`)
- Bun.serve: `vi.stubGlobal("Bun", { serve: vi.fn() })` — captures `fetch` handler for direct testing

**Test coverage (90 tests across 6 files):**

- `phone-validation.test.ts` — 22 scenarios (valid/invalid formats, boundary values, normalization)
- `phone.service.test.ts` — 14 scenarios (success, user not found, already has phone, phone taken, same user, DB error)
- `contact.handler.test.ts` — 19 scenarios (valid contact, wrong contact, invalid phone, languages, errors)
- `bot.test.ts` — 13 scenarios (bot handlers, /start, message, ctx.from guard)
- `bot.index.test.ts` — 12 scenarios (webhook routing, health check, shutdown, webhook registration)
- `user.service.test.ts` — 10 scenarios (user lookup, language defaults, DB failure, edge cases)
