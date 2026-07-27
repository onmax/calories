# ViteHub Calories

A private-input, read-only meal log. Telegram accepts food photos from one numeric user ID, ViteHub handles the conversation, and the public Nuxt UI shows the resulting calorie estimates.

Production: <https://vitehub-calories.maximogarciamtnez.workers.dev>

## Runtime

- Nuxt nightly, Vue, and Nuxt UI render the read-only dashboard as a client-side app.
- Nitro v3 emits the Cloudflare Worker and serves both the UI and API.
- ViteHub Agent filters Telegram input, validates structured image analysis, and streams the saved result through Chat SDK.
- ViteHub Blob stores original photos privately in Cloudflare R2.
- ViteHub Database uses SQLite locally and Cloudflare D1 in production.
- Vercel AI SDK sends images to Vercel AI Gateway using `VERCEL_AI_GATEWAY_TOKEN`.

## Input lifecycle

```text
Telegram photo
  → allow numeric Telegram user ID
  → admit exactly one image
  → show a temporary Chat SDK fallback
  → analyze through Vercel AI Gateway with driver.output
  → validate the structured estimate
  → store the original in R2 and the meal in D1
  → replace the fallback with the meal, daily total, remaining limit, and dashboard URL
```

Messages that are not exactly one image are ignored before Agent invocation. Each accepted invocation creates one ready meal; Agent chat history and Telegram retry deduplication are intentionally absent.

## Source layout

```text
app/
  pages/index.vue                 read-only meal dashboard
  assets/main.css                 dashboard styling
  utils/meal.ts                   meal types and display helpers
examples/
  post-workout-meal.png           generated Gateway smoke-test image
  README.md                       generation prompt and smoke-test result
server/
  agents/calories/agent.ts        Telegram filter, analysis, persistence, and streamed reply
  agents/calories/instructions.md model instructions
  databases/config.ts             ViteHub/Drizzle D1 schema
  databases/migrations/           generated D1 migrations
  api/meals.get.ts                only application API; read-only
  utils/meal-analysis.ts          structured output schema
vite.config.ts                    ViteHub plugin and environment
nuxt.config.ts                    Nuxt UI, ViteHub modules, Nitro v3
patches/                          Telegram JPEG MIME compatibility patch
scripts/
  set-telegram-webhook.mjs        webhook registration
  stage-d1-migrations.mjs         migration handoff to Wrangler
  stage-spa.mjs                   Nuxt nightly SPA shell for Worker assets
```

## Local development

```sh
cp .env.example .env
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm dev
```

The `.env` file needs the existing Gateway and Telegram tokens. `TELEGRAM_ALLOWED_USER_ID` is the numeric `message.from.id`, not a username or chat handle.

## Cloudflare deployment

Create or bind the D1 database and R2 bucket, then set the Worker secrets:

```sh
pnpm db:migrate:remote
pnpm deploy
pnpm telegram:webhook
```

`APP_URL`, `TELEGRAM_ALLOWED_USER_ID`, and `TELEGRAM_WEBHOOK_SECRET` must be present when registering the webhook. Telegram requires the user to start the bot once before the bot can learn the numeric ID or send a message back.

## Compatibility patch

The repository keeps one narrow pnpm patch:

- `@chat-adapter/telegram` supplies `image/jpeg` metadata for Telegram photos.

The patch can be removed when that metadata ships upstream.
