import assert from "node:assert/strict"
import test from "node:test"
import { defineAgent, runAgentTrigger } from "vite-hub/agent"
import { discord, telegram } from "vite-hub/agent/channels"

const generateResult = {
  content: [{ text: "ok", type: "text" }],
  finishReason: { raw: "stop", unified: "stop" },
  usage: {
    inputTokens: {
      cacheRead: 0,
      cacheWrite: 0,
      noCache: 3,
      total: 3,
    },
    outputTokens: {
      reasoning: 0,
      text: 1,
      total: 1,
    },
  },
  warnings: [],
}

function createModel() {
  const doGenerateCalls = []
  return {
    doGenerate: async (options) => {
      doGenerateCalls.push(options)
      return generateResult
    },
    doGenerateCalls,
    doStream: async () => {
      throw new Error("Unexpected streaming model call")
    },
    modelId: "telegram-instructions-test",
    provider: "test",
    specificationVersion: "v3",
    supportedUrls: {},
  }
}

async function modelCallFor(origin) {
  const model = createModel()
  let inputMessages
  const agent = defineAgent({
    channels: {
      discord: discord(),
      telegram: telegram(),
    },
    driver: {
      instructions: "Keep the calorie records accurate.",
      model,
    },
    hooks: {
      "agent:input": ({ input }) => {
        inputMessages = input.messages
      },
    },
  })

  await runAgentTrigger(agent, {
    memo: () => undefined,
    runtime: "unknown",
    runtimeConfig: {},
    waitUntil: () => undefined,
  }, "chat.message", {
    messages: [
      {
        id: "1",
        parts: [{ text: "Did we save dinner?", type: "text" }],
        role: "user",
      },
      {
        id: "2",
        parts: [{ text: "Yes.", type: "text" }],
        role: "assistant",
      },
      {
        id: "3",
        parts: [{ text: "Show it again.", type: "text" }],
        role: "user",
      },
    ],
    run: {
      channelId: origin,
      origin,
      runId: `${origin}:1`,
      threadId: `${origin}:1`,
    },
  })

  return {
    inputMessages,
    modelCall: model.doGenerateCalls[0],
  }
}

test("ViteHub keeps Telegram history as messages and composes one instruction document", async () => {
  const { inputMessages, modelCall } = await modelCallFor("telegram")
  const systemMessages = modelCall.prompt.filter(message => message.role === "system")

  assert.deepEqual(inputMessages.map(message => message.role), ["user", "assistant", "user"])
  assert.equal(systemMessages.length, 1)
  assert.match(systemMessages[0].content, /Keep the calorie records accurate/)
  assert.match(systemMessages[0].content, /Match the language of the user's latest message/)
  assert.match(systemMessages[0].content, /Do not use Markdown tables/)
  assert.deepEqual(modelCall.prompt.map(message => message.role), ["system", "user", "assistant", "user"])
})

test("ViteHub only adds Telegram response guidance to Telegram turns", async () => {
  const { modelCall } = await modelCallFor("discord")
  const systemMessages = modelCall.prompt.filter(message => message.role === "system")

  assert.equal(systemMessages.length, 1)
  assert.match(systemMessages[0].content, /Keep the calorie records accurate/)
  assert.doesNotMatch(systemMessages[0].content, /Do not use Markdown tables/)
})
