import { defineConfig } from "vite"
import { vitehub, type ViteHubOptions } from "vite-hub"
import { env, type EnvViteUserConfig } from "vite-hub/env"

const development = process.env.NODE_ENV !== "production"

export const viteHubOptions = {
  preset: "cloudflare",
  agent: {
    eval: false,
  },
  blob: development
    ? {
        base: ".vitehub/data/blob",
        driver: "fs",
        serve: { route: "/photos" },
      }
    : {
        serve: { route: "/photos" },
      },
  database: {
    databaseId: process.env.CLOUDFLARE_D1_DATABASE_ID,
    databaseName: process.env.CLOUDFLARE_D1_DATABASE_NAME || "vitehub-calories",
    driver: "d1",
    remote: true,
  },
} satisfies ViteHubOptions

export const viteConfig = {
  env: {
    server: {
      telegram: {
        allowedUserId: env({
          source: env.source("TELEGRAM_ALLOWED_USER_ID"),
        }),
        botToken: env({
          secret: true,
          source: env.source("TELEGRAM_TOKEN"),
        }),
        webhookSecret: env({
          optional: true,
          secret: true,
          source: env.source("TELEGRAM_WEBHOOK_SECRET"),
        }),
      },
      vercelAiGatewayToken: env({
        secret: true,
        source: env.source("VERCEL_AI_GATEWAY_TOKEN"),
      }),
    },
  },
  plugins: [vitehub(viteHubOptions)],
} satisfies Parameters<typeof defineConfig>[0] & EnvViteUserConfig

export default defineConfig(viteConfig)
