import assert from "node:assert/strict"
import test from "node:test"
import { defineAgent, runAgent } from "vite-hub/agent"
import { usageCost, vercelAiGatewayPricing } from "vite-hub/agent/capabilities"

test("ViteHub usage cost enriches the normalized invocation record", async () => {
  let usageRecord
  const agent = defineAgent({
    capabilities: [
      usageCost({
        format: "usd",
        pricing: vercelAiGatewayPricing({
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
        usageRecord = event.extensions.get("usage-cost")
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
    formatted: "~$0.001160",
    source: "vercel-ai-gateway",
  })
})
