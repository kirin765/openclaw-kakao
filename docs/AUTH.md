# Kakao Authentication & Token Guide

This guide covers Kakao credential provisioning, rotation, and safe secret handling for `openclaw-kakao`.

## 1) Required credentials

For non-dry-run environments (`KAKAO_DRY_RUN=false`), configure:

- `KAKAO_REST_API_KEY` — Kakao REST API app key
- `KAKAO_WEBHOOK_SECRET` — shared secret used to verify webhook signatures
- `KAKAO_CHANNEL_TOKEN` — channel access token used for outbound send authorization

Optional endpoint overrides:

- `KAKAO_API_BASE_URL`
- `KAKAO_WEBHOOK_BASE_URL`

## 2) Provisioning flow

1. Create/select Kakao developer app in Kakao Developers console.
2. Enable the messaging/channel product used by your bot.
3. Generate or copy REST app key (`KAKAO_REST_API_KEY`).
4. Configure webhook callback URL in Kakao console.
5. Create webhook signing secret and set same value as `KAKAO_WEBHOOK_SECRET`.
6. Generate channel token and set as `KAKAO_CHANNEL_TOKEN`.

> Keep all three values in your secret store and inject at runtime.

## 3) Local setup

```bash
cp .env.example .env
```

Then set:

```dotenv
KAKAO_DRY_RUN=true
KAKAO_WEBHOOK_SECRET=local-dev-webhook-secret
```

When switching to real Kakao API:

```dotenv
KAKAO_DRY_RUN=false
KAKAO_REST_API_KEY=<real key>
KAKAO_WEBHOOK_SECRET=<real secret>
KAKAO_CHANNEL_TOKEN=<real token>
```

## 4) Rotation playbook

Recommended cadence: rotate tokens/secrets on a schedule (for example every 60-90 days) and immediately on leak suspicion.

### Channel token rotation

1. Generate new token in Kakao console.
2. Update secret manager entry for `KAKAO_CHANNEL_TOKEN`.
3. Deploy/restart runtime to load new secret.
4. Verify outbound send via health check or test message.
5. Revoke old token after verification.

### Webhook secret rotation (safe cutover)

If Kakao allows overlap:

1. Generate new webhook secret.
2. Update Kakao webhook signer and server secret near-simultaneously.
3. Monitor webhook `401 invalid_signature` errors.
4. Remove old secret after stable traffic.

If overlap is not supported, schedule a short maintenance window and coordinate change atomically.

## 5) Secret handling best practices

- Never commit secrets to git (`.env` must remain local-only).
- Use environment injection from a secret manager (Vault, AWS/GCP/Azure secret services, etc.).
- Restrict read access by environment and role (least privilege).
- Redact secrets in logs and tickets.
- Keep separate credentials for dev/staging/prod.
- Rotate immediately when personnel/access scope changes.

## 6) Leak response checklist

If a credential is exposed:

1. Revoke/rotate affected key(s) immediately.
2. Roll updated secrets to all active environments.
3. Audit recent outbound activity and webhook failures.
4. Check CI logs/chat history for accidental plaintext exposure.
5. Record incident and improve controls (masking, access, TTL).

## 7) Verification commands

```bash
npm run typecheck
npm run test
npm run dev:example
npm run example:simulate
```

Expected local result:

- simulator returns HTTP `200`
- no `invalid_signature` or missing-credential startup errors
