import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

import { config as loadDotEnv } from 'dotenv';

import {
  createKakaoInboundWebhookController,
  type KakaoWebhookHttpRequest
} from '../channel/kakao/webhook.js';
import {
  createKakaoChannelProvider,
  type KakaoChannelProvider
} from '../channel/kakao/provider.js';

export interface EchoExampleRuntime {
  start(): Promise<void>;
  stop(): Promise<void>;
  readonly port: number;
}

export interface CreateEchoExampleRuntimeOptions {
  env?: NodeJS.ProcessEnv;
  providerFactory?: (env: NodeJS.ProcessEnv) => KakaoChannelProvider;
}

const readBody = async (request: IncomingMessage): Promise<string> => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString('utf8');
};

const writeJson = (response: ServerResponse, status: number, payload: unknown): void => {
  response.statusCode = status;
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(payload));
};

const toWebhookRequest = async (request: IncomingMessage): Promise<KakaoWebhookHttpRequest> => {
  const body = await readBody(request);
  const headers: Record<string, string | undefined> = {};

  for (const [key, value] of Object.entries(request.headers)) {
    headers[key] = Array.isArray(value) ? value.join(',') : value;
  }

  return { headers, body };
};

export const createEchoExampleRuntime = (
  options: CreateEchoExampleRuntimeOptions = {}
): EchoExampleRuntime => {
  if (!options.env) {
    loadDotEnv();
  }

  const env = options.env ?? process.env;
  const port = Number(env.EXAMPLE_PORT ?? 8787);
  const webhookPath = env.EXAMPLE_WEBHOOK_PATH ?? '/webhooks/kakao';
  const provider = (options.providerFactory ?? ((providerEnv) => createKakaoChannelProvider({ env: providerEnv })))(env);

  const webhookSecret = env.KAKAO_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error('KAKAO_WEBHOOK_SECRET is required for local example webhook signature checks.');
  }

  const controller = createKakaoInboundWebhookController({
    webhookSecret,
    channelToken: env.KAKAO_CHANNEL_TOKEN,
    onIncomingMessage: async (event) => {
      await provider.send(event.channelId, `echo: ${event.text}`);
    }
  });

  const server = createServer(async (request, response) => {
    if (request.method === 'GET' && request.url === '/healthz') {
      writeJson(response, 200, { ok: true, channel: 'kakao' });
      return;
    }

    if (request.method === 'POST' && request.url === webhookPath) {
      const webhookRequest = await toWebhookRequest(request);
      const webhookResponse = await controller(webhookRequest);
      writeJson(response, webhookResponse.status, webhookResponse.body);
      return;
    }

    writeJson(response, 404, {
      ok: false,
      reason: 'not_found',
      hint: `POST ${webhookPath} or GET /healthz`
    });
  });

  return {
    port,
    async start() {
      await provider.boot();
      await new Promise<void>((resolve) => {
        server.listen(port, resolve);
      });
    },
    async stop() {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
      await provider.shutdown();
    }
  };
};