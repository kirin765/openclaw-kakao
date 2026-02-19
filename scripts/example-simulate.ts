import { createHmac } from 'node:crypto';

import { config as loadDotEnv } from 'dotenv';

loadDotEnv();

const port = Number(process.env.EXAMPLE_PORT ?? 8787);
const webhookPath = process.env.EXAMPLE_WEBHOOK_PATH ?? '/webhooks/kakao';
const webhookSecret = process.env.KAKAO_WEBHOOK_SECRET;

if (!webhookSecret) {
  throw new Error('KAKAO_WEBHOOK_SECRET is required.');
}

const payload = JSON.stringify({
  event: {
    id: `evt_${Date.now()}`,
    type: 'message',
    channel_id: process.env.EXAMPLE_CHANNEL_ID ?? 'room-demo',
    user: { id: process.env.EXAMPLE_USER_ID ?? 'user-demo' },
    message: {
      type: 'text',
      text: process.env.EXAMPLE_TEXT ?? 'hello from local simulate'
    }
  }
});

const signature = createHmac('sha256', webhookSecret).update(payload).digest('hex');
const webhookUrl = `http://localhost:${port}${webhookPath}`;

const response = await fetch(webhookUrl, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-kakao-signature': signature,
    ...(process.env.KAKAO_CHANNEL_TOKEN
      ? { 'x-kakao-channel-token': process.env.KAKAO_CHANNEL_TOKEN }
      : {})
  },
  body: payload
});

console.log('[simulate] status:', response.status);
console.log('[simulate] body:', await response.text());