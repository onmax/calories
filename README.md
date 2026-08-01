# ViteHub Calories

A private-input, read-only meal log. Telegram accepts food photos from one numeric user ID, ViteHub handles the conversation, and the public Nuxt UI shows the resulting calorie estimates.

Production: <https://vitehub-calories.maximogarciamtnez.workers.dev>

## Runtime

- Nuxt nightly, Vue, and Nuxt UI render the read-only dashboard as a client-side app.
- Nitro v3 emits the Cloudflare Worker and serves both the UI and API.
- ViteHub Agent filters Telegram input, validates structured image analysis, and streams the saved result through Chat SDK.
- ViteHub Blob stores original photos privately in Cloudflare R2.
- ViteHub Database uses the remote Cloudflare D1 binding during local development and production.
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
patches/                          package compatibility patches
```

## Local development

```sh
cp .env.example .env
pnpm install
pnpm db:generate
pnpm dev
```

The `.env` file needs a scoped Cloudflare D1 token plus the existing Gateway and Telegram tokens. `TELEGRAM_ALLOWED_USER_ID` is the numeric `message.from.id`, not a username or chat handle. Local database writes affect the remote D1 database.

## Cloudflare deployment

Create or bind the D1 database and R2 bucket, then set the Worker secrets:

```sh
pnpm db:migrate:remote
pnpm deploy
pnpm telegram:webhook
pnpm telegram:webhook --apply --confirm-origin https://your-deployed-origin.example
```

Set `VITEHUB_DEPLOYMENT_URL` in `.env` to the exact deployed HTTPS origin before running these commands; ViteHub will not infer a Worker or preview URL. `TELEGRAM_TOKEN` and `TELEGRAM_WEBHOOK_SECRET` must also be present. The first command inspects Telegram and prints the proposed route without mutating it, while the second applies only after the confirmation origin matches. `TELEGRAM_ALLOWED_USER_ID` is still required by the running app, and Telegram requires the user to start the bot once before it can learn the numeric ID or send a message back.

## Compatibility patch

The repository temporarily patches `@chat-adapter/telegram` to aggregate incoming Telegram albums. The fix is merged upstream in [vercel/chat#760](https://github.com/vercel/chat/pull/760) but has not shipped in a release yet.

Remove the patch after upgrading to the first `@chat-adapter/telegram` release containing that pull request.
