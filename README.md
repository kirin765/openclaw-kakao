# openclaw-kakao

Baseline TypeScript repository for building a KakaoTalk channel integration module for OpenClaw.

## Requirements

- Node.js 20+
- npm 10+

## Quick start

```bash
npm install
npm run lint
npm run test
npm run typecheck
npm run build
```

## Scripts

- `npm run lint` — run ESLint
- `npm run test` — run Vitest tests
- `npm run typecheck` — run TypeScript type checking
- `npm run build` — compile TypeScript to `dist/`
- `npm run format` / `npm run format:check` — run Prettier
- `npm run dev:example` — start local Kakao echo-bot webhook server
- `npm run example:simulate` — send a signed sample webhook payload to the local example

## Local runnable example (echo bot)

1. Copy env template and edit values:

```bash
cp .env.example .env
```

Minimum local values:

- `KAKAO_DRY_RUN=true`
- `KAKAO_WEBHOOK_SECRET=<any local secret>`
- `EXAMPLE_PORT` / `EXAMPLE_WEBHOOK_PATH` (optional, defaults provided)

2. Start example server:

```bash
npm run dev:example
```

3. In another terminal, send sample inbound payload:

```bash
npm run example:simulate
```

The local runtime validates webhook signature, converts inbound message event, then triggers outbound send with an `echo: <text>` response through the Kakao provider (dry-run mode by default).

### Webhook tunneling (for Kakao sandbox/real callbacks)

Use a tunnel and point Kakao webhook URL to your local example endpoint:

```bash
# example with ngrok
ngrok http 8787
```

Then set Kakao callback URL to:

`https://<ngrok-id>.ngrok-free.app/webhooks/kakao`

Ensure `KAKAO_WEBHOOK_SECRET` and optional `KAKAO_CHANNEL_TOKEN` in `.env` match the Kakao app/webhook settings.

## Kakao inbound state strategy (US-07)

`createKakaoInboundWebhookController` uses an injectable `KakaoChannelState` for two reliability needs:

- **Deduplication**: processed webhook `event.id` values are tracked via `hasProcessedEvent` / `markEventProcessed`; duplicate deliveries are ignored with `202` and `reason=duplicate_event`.
- **Conversation mapping**: `(channelId, userId)` is mapped to `conversationId` via `getConversationId` / `setConversationId`.

Default implementation is `InMemoryKakaoChannelState` in `src/channel/kakao/state.ts`.
For production, replace with a persistent implementation (file/SQLite/DB) by injecting `state` into the webhook controller.
