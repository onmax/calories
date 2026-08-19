# ViteHub Calories

A private-input, read-only meal log. Telegram accepts food photos from one numeric user ID, ViteHub handles the conversation, and the public Nuxt UI shows the resulting calorie estimates.

Fork it, connect your own Cloudflare, OpenRouter, and Telegram credentials, then deploy the Worker.

## Runtime

- Nuxt nightly, Vue, and Nuxt UI render the read-only dashboard as a client-side app.
- Nitro v3 emits the Cloudflare Worker and serves both the UI and API.
- ViteHub Agent connects Telegram to a model with database-write, blob, and usage-cost Capabilities, then renders the structured result through Chat SDK.
- ViteHub Blob stores original photos privately in Cloudflare R2.
- ViteHub Database uses generated local artifacts during development and a Cloudflare D1 binding in production.
- The AI SDK sends images to GLM 5V Turbo and audio to Voxtral through OpenRouter using `OPENROUTER_API_KEY`.

## Input lifecycle

```text
Telegram message
  → allow numeric Telegram user ID
  → show a temporary Chat SDK fallback
  → transcribe audio through OpenRouter when present
  → invoke the Agent through OpenRouter
  → use ViteHub Capabilities to read or update D1 and R2
  → replace the fallback with the result, usage cost, and dashboard URL
```

The same Agent Definition handles new meals, corrections, removals, and journal questions. Telegram supplies the current message, while D1 remains authoritative for entries and totals.

## Project layout

```text
app/
  pages/index.vue                 read-only meal dashboard
  assets/main.css                 dashboard styling
  utils/meal.ts                   meal types and display helpers
server/
  agents/calories/agent.ts        Telegram channel, structured output, persistence, and reply
  templates/{meal,reply}.md       Markdown reply templates with runtime values
  agents/calories/instructions.md model instructions
  databases/config.ts             ViteHub/Drizzle D1 schema
  databases/migrations/           generated D1 migrations
  api/meals.get.ts                read-only dashboard query
nuxt.config.ts                    ViteHub, Nuxt UI, environment, and Nitro
```

## Local development

```sh
cp .env.example .env
vp install
vp run db:generate
vp run dev
```

The `.env` file needs a scoped Cloudflare D1 token plus the existing OpenRouter and Telegram tokens. `TELEGRAM_ALLOWED_USER_ID` is the numeric `message.from.id`, not a username or chat handle. Remote D1 migrations run only through the explicit deployment command below.

## Cloudflare deployment

Create a Cloudflare D1 database named `vitehub-calories` or change `databaseName` in `nuxt.config.ts`, create the R2 bucket required by ViteHub Blob, then set the Worker secrets from `.env.example`:

```sh
vp run db:migrate:remote
vp run deploy
vp run telegram:webhook
vp run telegram:webhook -- --apply --confirm-origin https://your-deployed-origin.example
```

Set `VITEHUB_DEPLOYMENT_URL` in `.env` to the exact deployed HTTPS origin before running these commands; ViteHub will not infer a Worker or preview URL. `TELEGRAM_BOT_TOKEN` and `TELEGRAM_WEBHOOK_SECRET_TOKEN` must also be present. The first command inspects Telegram and prints the proposed route without mutating it, while the second applies only after the confirmation origin matches. `TELEGRAM_ALLOWED_USER_ID` is still required by the running app, and Telegram requires the user to start the bot once before it can learn the numeric ID or send a message back.
