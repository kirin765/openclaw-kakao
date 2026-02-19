import { existsSync } from 'node:fs';

const requiredFiles = ['package.json', 'tsconfig.json', 'README.md', '.editorconfig'] as const;

export function validateBootstrap(rootDir = process.cwd()): { ok: boolean; missing: string[] } {
  const missing = requiredFiles.filter((file) => !existsSync(`${rootDir}/${file}`));
  return { ok: missing.length === 0, missing };
}
