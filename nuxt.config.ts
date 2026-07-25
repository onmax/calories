import viteHubNuxt from "vite-hub/nuxt"
import { viteConfig, viteHubOptions } from "./vite.config"

export default defineNuxtConfig({
  compatibilityDate: "2026-07-24",
  modules: [
    "@nuxt/ui",
    "@vite-hub/database/nuxt",
    [viteHubNuxt as any, viteHubOptions],
  ],
  database: viteHubOptions.database,
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
      config.handlers = config.handlers?.filter(handler => handler.route !== "/api/_nuxt_icon/:collection")
    },
  },
  vite: viteConfig,
  devtools: { enabled: false },
  nitro: {
    serverAssets: [{
      baseName: "calories-agent",
      dir: "server/agents/calories",
      pattern: "reply.md",
    }],
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
})
