# ViteHub Calories

A starter template for experimenting with a ViteHub Agent in a complete application. Send a meal by text, photo, or voice message; the Agent estimates its calories and protein, saves the result, and shows it in a Nuxt dashboard.

This is a working example, not a lesson or prescribed application structure. Fork it, replace the choices you do not want, and keep only the parts that help your application.

## Defaults, not requirements

The included application uses:

- Telegram as its input channel.
- OpenRouter with `z-ai/glm-5v-turbo` for meal analysis and `mistralai/voxtral-small-24b-2507` for voice transcription.
- Cloudflare Workers, D1, and R2 for deployment, meal data, and photos.
- A Nuxt, Vue, and Nuxt UI dashboard.

These are configuration choices. Change the channel, AI provider, models, Capabilities, storage, UI, or deployment provider to fit what you want to build.

ViteHub has deployment presets for Cloudflare, Vercel, Netlify, Deno, and Node, with supported provider adapters selected for each host. This repository's D1 database and deployment scripts are Cloudflare-specific, so adapt those when switching presets.

## Tech stack

- [ViteHub](https://vitehub.dev) for the Agent Definition, Telegram channel, Capabilities, environment values, database, and Blob storage.
- [Nuxt](https://nuxt.com), [Vue](https://vuejs.org), and [Nuxt UI](https://ui.nuxt.com) for the dashboard and API.
- [AI SDK](https://ai-sdk.dev) with [OpenRouter](https://openrouter.ai) for the included models.
- [Drizzle ORM](https://orm.drizzle.team) for meal persistence.
- Nitro and Wrangler for the included Cloudflare Worker deployment.

## Start experimenting

Requirements: Node.js 24 or newer and pnpm 10.

```sh
git clone https://github.com/vite-hub/calories.git
cd calories
pnpm install
cp .env.example .env
```

Add your OpenRouter and Telegram credentials to `.env`:

```dotenv
OPENROUTER_API_KEY=
TELEGRAM_BOT_TOKEN=
TELEGRAM_ALLOWED_USER_ID=
```

`TELEGRAM_ALLOWED_USER_ID` is the numeric Telegram `message.from.id`, not a username. The other variables in `.env.example` configure the included Cloudflare deployment and optional Telegram webhook protection.

Apply the included migrations to the local database and start Nuxt:

```sh
pnpm db:migrate
pnpm dev
```

Open <http://localhost:3000>. Telegram needs a public HTTPS deployment or tunnel before it can send webhook requests to the Agent.

## Make it yours

Start in `server/agents/calories/agent.ts`. It contains the Telegram channel, OpenRouter models, Capabilities, and reply behavior. The meal-specific instructions live in `server/agents/calories/instructions.md`, while `nuxt.config.ts` selects the deployment preset and storage configuration.

Some useful first changes:

- Replace `telegram(...)` with another channel or invoke the Agent from your own server route.
- Replace `createOpenRouter(...)` and the model IDs with your preferred AI provider and models.
- Remove the meal schema and persistence Capability, then add the tools and instructions your Agent needs.
- Change `vitehub.preset` and provider-specific storage when deploying somewhere other than Cloudflare.
- Replace the dashboard with your own Nuxt interface, another frontend, or no UI at all.

## Deploy the included Cloudflare version

Create your own D1 database and R2 bucket, complete the Cloudflare variables in `.env`, then run:

```sh
pnpm db:migrate:remote
pnpm deploy
```

Set `VITEHUB_DEPLOYMENT_URL` to the deployed HTTPS origin before inspecting and applying the Telegram webhook:

```sh
pnpm telegram:webhook
pnpm telegram:webhook -- --apply --confirm-origin https://your-deployed-origin.example
```

The first webhook command only shows the proposed change. The second applies it after the confirmation origin matches.
