import { env, type EnvViteUserConfig } from "vite-hub/env";

export default defineNuxtConfig({
  compatibilityDate: "2026-07-24",
  app: {
    head: {
      htmlAttrs: { lang: "en" },
      meta: [{ name: "color-scheme", content: "dark" }],
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
      databaseId: env({ source: env.source("CLOUDFLARE_D1_DATABASE_ID") }),
      databaseName: "vitehub-calories",
    },
  },
  css: ["~/assets/main.css"],
  ui: {
    colorMode: false,
  },
  ssr: false,
  icon: {
    clientBundle: { scan: true },
    fallbackToApi: false,
    provider: "none",
    serverBundle: false,
  },
  hooks: {
    "nitro:config"(config) {
      config.handlers = config.handlers?.filter(
        (handler) => handler.route !== "/api/_nuxt_icon/:collection",
      );
    },
  },
  vite: {
    env: {
      server: {
        aiGateway: {
          apiKey: env({
            source: env.source("VERCEL_AI_GATEWAY_TOKEN"),
          }),
        },
        calories: {
          timeZone: env({
            optional: true,
            source: env.source("CALORIES_TIME_ZONE"),
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
  } satisfies EnvViteUserConfig,
  devtools: { enabled: false },
  nitro: {
    cloudflare: {
      wrangler: {
        observability: { enabled: true },
      },
    },
    typescript: {
      tsConfig: {
        compilerOptions: { types: ["@cloudflare/workers-types"] },
        include: ["../.vitehub/types/**/*.d.ts"],
      },
    },
  },
  typescript: {
    strict: true,
    tsConfig: {
      compilerOptions: { types: ["@cloudflare/workers-types"] },
      include: ["../.vitehub/types/**/*.d.ts"],
    },
    typeCheck: true,
  },
});
