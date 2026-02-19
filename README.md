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

## Kakao inbound state strategy (US-07)

`createKakaoInboundWebhookController` uses an injectable `KakaoChannelState` for two reliability needs:

- **Deduplication**: processed webhook `event.id` values are tracked via `hasProcessedEvent` / `markEventProcessed`; duplicate deliveries are ignored with `202` and `reason=duplicate_event`.
- **Conversation mapping**: `(channelId, userId)` is mapped to `conversationId` via `getConversationId` / `setConversationId`.

Default implementation is `InMemoryKakaoChannelState` in `src/channel/kakao/state.ts`.
For production, replace with a persistent implementation (file/SQLite/DB) by injecting `state` into the webhook controller.
