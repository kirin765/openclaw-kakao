import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { validateBootstrap } from '../scripts/bootstrap.js';

describe('validateBootstrap', () => {
  it('returns ok when all required bootstrap files exist', () => {
    const root = mkdtempSync(join(tmpdir(), 'openclaw-kakao-bootstrap-'));
    for (const file of ['package.json', 'tsconfig.json', 'README.md', '.editorconfig']) {
      writeFileSync(join(root, file), '');
    }

    const result = validateBootstrap(root);

    expect(result).toEqual({ ok: true, missing: [] });
  });

  it('returns missing files when baseline is incomplete', () => {
    const root = mkdtempSync(join(tmpdir(), 'openclaw-kakao-bootstrap-'));
    writeFileSync(join(root, 'package.json'), '');

    const result = validateBootstrap(root);

    expect(result.ok).toBe(false);
    expect(result.missing).toEqual(expect.arrayContaining(['tsconfig.json', 'README.md', '.editorconfig']));
  });
});
