const botToken = process.env.TELEGRAM_TOKEN
const appUrl = process.env.APP_URL
const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET

if (!botToken || !appUrl || !secretToken) {
  throw new Error("APP_URL, TELEGRAM_TOKEN, and TELEGRAM_WEBHOOK_SECRET are required.")
}

const response = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    allowed_updates: ["message"],
    drop_pending_updates: false,
    secret_token: secretToken,
    url: new URL("/api/_vitehub/agents/calories/webhooks/telegram", appUrl).href,
  }),
})

const result = await response.json()
if (!response.ok || !result.ok) throw new Error(`Telegram rejected the webhook: ${JSON.stringify(result)}`)
console.log(`Telegram webhook set to ${new URL("/api/_vitehub/agents/calories/webhooks/telegram", appUrl).href}`)
