# ViteHub Calories

A private-input, read-only meal log. Telegram accepts food photos from one numeric user ID, ViteHub handles the conversation, and the public Nuxt UI shows the resulting calorie estimates.

Production: <https://vitehub-calories.maximogarciamtnez.workers.dev>

## Runtime

- Nuxt nightly, Vue, and Nuxt UI render the read-only dashboard as a client-side app.
- Nitro v3 emits the Cloudflare Worker and serves both the UI and API.
- ViteHub Agent connects Telegram to a model with database, blob, and usage-cost Capabilities, then streams the reply through Chat SDK.
- ViteHub Blob stores original photos privately in Cloudflare R2.
- ViteHub Database uses generated local artifacts during development and a Cloudflare D1 binding in production.
- Vercel AI SDK sends images to Vercel AI Gateway using `AI_GATEWAY_API_KEY`.

## Input lifecycle

```text
Telegram message
  → allow numeric Telegram user ID
  → show a temporary Chat SDK fallback
  → invoke the Agent through Vercel AI Gateway
  → use ViteHub Capabilities to read or update D1 and R2
  → replace the fallback with the result, usage cost, and dashboard URL
```

The same Agent Definition handles new meals, corrections, removals, and journal questions. Telegram supplies bounded thread history for references, while D1 remains authoritative for entries and totals.

## Project layout

```text
app/
  pages/index.vue                 read-only meal dashboard
  assets/main.css                 dashboard styling
  utils/meal.ts                   meal types and display helpers
server/
  agents/calories/agent.ts        Telegram filter, analysis, persistence, and streamed reply
  agents/calories/instructions.md model instructions
  databases/config.ts             ViteHub/Drizzle D1 schema
  databases/migrations/           generated D1 migrations
  api/meals.get.ts                read-only dashboard query
nuxt.config.ts                    ViteHub, Nuxt UI, environment, and Nitro
patches/                          package compatibility patches
```

## Local development

```sh
cp .env.example .env
vp install
vp run db:generate
vp run dev
```

The `.env` file needs a scoped Cloudflare D1 token plus the existing Gateway and Telegram tokens. `TELEGRAM_ALLOWED_USER_ID` is the numeric `message.from.id`, not a username or chat handle. Remote D1 migrations run only through the explicit deployment command below.

## Cloudflare deployment

Create or bind the D1 database and R2 bucket, then set the Worker secrets:

```sh
vp run db:migrate:remote
vp run deploy
vp run telegram:webhook
vp run telegram:webhook -- --apply --confirm-origin https://your-deployed-origin.example
```

Set `VITEHUB_DEPLOYMENT_URL` in `.env` to the exact deployed HTTPS origin before running these commands; ViteHub will not infer a Worker or preview URL. `TELEGRAM_BOT_TOKEN` and `TELEGRAM_WEBHOOK_SECRET_TOKEN` must also be present. The first command inspects Telegram and prints the proposed route without mutating it, while the second applies only after the confirmation origin matches. `TELEGRAM_ALLOWED_USER_ID` is still required by the running app, and Telegram requires the user to start the bot once before it can learn the numeric ID or send a message back.

## Compatibility patch

The repository temporarily patches `@chat-adapter/telegram` to aggregate incoming Telegram albums. The fix is merged upstream in [vercel/chat#760](https://github.com/vercel/chat/pull/760) but has not shipped in a release yet. The remaining ViteHub patch keeps Nuxt generation, Cloudflare prerendering, and D1 runtime state inside the ViteHub integration while the project is pinned to a preview build.

Remove the patch after upgrading to the first `@chat-adapter/telegram` release containing that pull request.
