import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = resolve(__dirname, '..');

const read = (relativePath: string): string =>
  readFileSync(resolve(repoRoot, relativePath), 'utf8');

describe('documentation', () => {
  it('README includes clone-to-send/receive quickstart and troubleshooting signatures', () => {
    const readme = read('README.md');

    expect(readme).toContain('git clone https://github.com/kirin765/openclaw-kakao.git');
    expect(readme).toContain('npm run dev:example');
    expect(readme).toContain('npm run example:simulate');
    expect(readme).toContain('receive -> normalize -> send pipeline');

    const troubleshootingItems = readme.match(/^\d+\. \*\*/gm) ?? [];
    expect(troubleshootingItems.length).toBeGreaterThanOrEqual(5);
  });

  it('AUTH guide documents provisioning, rotation, and secret handling practices', () => {
    const auth = read('docs/AUTH.md');

    expect(auth).toContain('Provisioning flow');
    expect(auth).toContain('Channel token rotation');
    expect(auth).toContain('Webhook secret rotation');
    expect(auth).toContain('Secret handling best practices');
    expect(auth).toContain('Leak response checklist');
  });

  it('documentation-linked npm commands exist in package scripts', () => {
    const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> };

    for (const scriptName of ['typecheck', 'test', 'dev:example', 'example:simulate', 'build']) {
      expect(pkg.scripts[scriptName]).toBeTypeOf('string');
      expect(pkg.scripts[scriptName].length).toBeGreaterThan(0);
    }
  });
});
