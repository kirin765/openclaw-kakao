# openclaw-kakao

KakaoTalk channel integration module for OpenClaw, including:

- channel plugin scaffold
- outbound send flow
- inbound webhook receive flow
- local echo-bot example for quick verification

## Requirements

- Node.js 20+
- npm 10+

## Installation

```bash
git clone https://github.com/kirin765/openclaw-kakao.git
cd openclaw-kakao
git checkout feat/kakao-channel-plugin
npm install
```

## Quickstart (first send/receive verification)

1. Copy env template:

```bash
cp .env.example .env
```

2. Ensure at least these values are set in `.env`:

```dotenv
KAKAO_DRY_RUN=true
KAKAO_WEBHOOK_SECRET=local-dev-webhook-secret
EXAMPLE_PORT=8787
EXAMPLE_WEBHOOK_PATH=/webhooks/kakao
```

3. Run quality checks:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

4. Start local example server:

```bash
npm run dev:example
```

5. In another terminal, simulate Kakao inbound webhook:

```bash
npm run example:simulate
```

6. Verify send/receive path:

- simulator prints `status: 200`
- example server accepts signed inbound message
- provider outbound send is invoked with `echo: <incoming text>`

This validates the full local receive -> normalize -> send pipeline in dry-run mode.

## Configuration

See `.env.example` for full variable list.

Required in production mode (`KAKAO_DRY_RUN=false`):

- `KAKAO_REST_API_KEY`
- `KAKAO_WEBHOOK_SECRET`
- `KAKAO_CHANNEL_TOKEN`

Optional:

- `KAKAO_API_BASE_URL`
- `KAKAO_WEBHOOK_BASE_URL`
- `EXAMPLE_PORT`
- `EXAMPLE_WEBHOOK_PATH`

## Authentication and token management

Full auth guide: [`docs/AUTH.md`](docs/AUTH.md)

Includes:

- Kakao app and webhook token provisioning
- channel token handling and rotation playbook
- secret handling best practices
- incident response checklist for leaked credentials

## Local testing

Main commands:

- `npm run test` — full test suite
- `npm run test -- test/kakao-integration-flow.test.ts` — integration flow only
- `npm run dev:example` — local echo runtime
- `npm run example:simulate` — signed inbound webhook simulation

## Troubleshooting

1. **Signature mismatch**
   - Symptom: `401` with `reason=invalid_signature`
   - Fix: ensure `KAKAO_WEBHOOK_SECRET` exactly matches Kakao webhook secret and simulator/app use same value.

2. **Channel token rejected**
   - Symptom: `401` with `reason=invalid_channel_token`
   - Fix: verify `KAKAO_CHANNEL_TOKEN` and `x-kakao-channel-token` header value; rotate token if uncertain.

3. **Malformed webhook JSON**
   - Symptom: `400` with `reason=invalid_json`
   - Fix: send valid JSON payload and set `content-type: application/json`.

4. **Missing production credentials**
   - Symptom: startup error listing missing env keys
   - Fix: set `KAKAO_REST_API_KEY`, `KAKAO_WEBHOOK_SECRET`, `KAKAO_CHANNEL_TOKEN` when `KAKAO_DRY_RUN=false`.

5. **Invalid endpoint URL override**
   - Symptom: startup error like `must be a valid http(s) URL`
   - Fix: correct `KAKAO_API_BASE_URL`/`KAKAO_WEBHOOK_BASE_URL` to full `http://` or `https://` URLs.

6. **No outbound response in local test**
   - Symptom: webhook returns success but expected echo not visible
   - Fix: confirm example server is running, simulator points to same `EXAMPLE_PORT`/`EXAMPLE_WEBHOOK_PATH`, and check terminal logs.

## Operational notes

- Keep dry-run enabled for CI/local development unless testing real Kakao delivery.
- Replace in-memory dedup/conversation state with persistent storage before production roll-out.
- Use webhook retries + idempotency (`event.id`) handling to survive duplicate deliveries.
- Store secrets in a secret manager (not in source control or plaintext chat).
- Validate rotation in staging first, then production (see `docs/AUTH.md`).

## Scripts

- `npm run lint` — run ESLint
- `npm run test` — run Vitest tests
- `npm run typecheck` — run TypeScript type checking
- `npm run build` — compile TypeScript to `dist/`
- `npm run format` / `npm run format:check` — run Prettier
- `npm run dev:example` — start local Kakao echo-bot webhook server
- `npm run example:simulate` — send a signed sample webhook payload to the local example
