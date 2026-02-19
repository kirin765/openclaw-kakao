import { createEchoExampleRuntime } from '../src/example/echo.js';

const main = async (): Promise<void> => {
  const runtime = createEchoExampleRuntime();
  await runtime.start();

  const webhookPath = process.env.EXAMPLE_WEBHOOK_PATH ?? '/webhooks/kakao';
  console.log('[example] Kakao echo bot is running');
  console.log(`[example] health: http://localhost:${runtime.port}/healthz`);
  console.log(`[example] webhook: http://localhost:${runtime.port}${webhookPath}`);

  const shutdown = async () => {
    await runtime.stop();
    process.exit(0);
  };

  process.once('SIGINT', () => {
    void shutdown();
  });
  process.once('SIGTERM', () => {
    void shutdown();
  });
};

void main();