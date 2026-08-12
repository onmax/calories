import { env } from "vite-hub/env";

export default defineNuxtConfig({
  compatibilityDate: "2026-07-24",
  app: {
    head: {
      htmlAttrs: { lang: "en" },
      meta: [{ name: "color-scheme", content: "light dark" }],
      title: "Calories",
    },
  },
  modules: ["@nuxt/ui", "vite-hub/nuxt"],
  vitehub: {
    preset: "cloudflare",
    agent: true,
    blob: {
      serve: { route: "/photos" },
    },
    database: {
      driver: "d1",
      databaseName: "vitehub-calories",
    },
  },
  css: ["~/assets/main.css"],
  ui: {
    colorMode: true,
  },
  ssr: false,
  icon: {
    clientBundle: { scan: true },
    provider: "none",
  },
  vite: {
    env: {
      server: {
        calories: {
          timeZone: env({
            optional: true,
            source: env.source("CALORIES_TIME_ZONE"),
          }),
        },
        openrouter: {
          apiKey: env({
            source: env.source("OPENROUTER_API_KEY"),
          }),
        },
        telegram: {
          allowedUserId: env({
            source: env.source("TELEGRAM_ALLOWED_USER_ID"),
          }),
          botToken: env({
            source: env.source("TELEGRAM_TOKEN"),
          }),
          webhookSecret: env({
            optional: true,
            source: env.source("TELEGRAM_WEBHOOK_SECRET"),
          }),
        },
      },
    },
  },
  devtools: { enabled: false },
  nitro: {
    cloudflare: {
      wrangler: {
        observability: { enabled: true },
      },
    },
  },
  typescript: {
    strict: true,
    typeCheck: true,
  },
});
