import assert from "node:assert/strict"
import test from "node:test"
import { defineAgent, runAgent } from "vite-hub/agent"
import { usage } from "vite-hub/agent/capabilities"

test("ViteHub usage enriches the normalized invocation record with cost", async () => {
  let usageRecord
  const agent = defineAgent({
    capabilities: [
      usage({
        fetch: async () => Response.json({
          data: [{
            id: "zai/glm-5v-turbo",
            pricing: {
              input: "0.0000012",
              output: "0.000004",
            },
          }],
        }),
      }),
    ],
    driver: {
      run: () => ({
        modelId: "zai/glm-5v-turbo",
        provider: "gateway",
        text: "ok",
        usage: {
          inputTokens: 800,
          outputTokens: 50,
          totalTokens: 850,
        },
      }),
    },
    hooks: {
      "agent:finish": event => {
        usageRecord = event.extensions.get("usage")
      },
    },
  })

  await runAgent(agent, {
    memo: () => undefined,
    runtime: "unknown",
    runtimeConfig: {},
    waitUntil: () => undefined,
  }, {
    prompt: "log breakfast",
  })

  assert.deepEqual(usageRecord?.cost, {
    amount: "0.00116",
    currency: "USD",
    estimated: true,
    source: "vercel-ai-gateway",
  })
})
