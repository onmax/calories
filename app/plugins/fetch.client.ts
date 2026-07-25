import { $fetch } from "ofetch"

const globals = globalThis as typeof globalThis & { $fetch?: typeof $fetch }
globals.$fetch ??= $fetch

export default defineNuxtPlugin({
  name: "fetch-global",
  enforce: "pre",
})
