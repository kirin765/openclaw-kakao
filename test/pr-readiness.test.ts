import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = resolve(__dirname, '..');

const read = (relativePath: string): string =>
  readFileSync(resolve(repoRoot, relativePath), 'utf8');

describe('release PR readiness artifacts', () => {
  it('provides PR template with story linkage, verification checklist, risks, and rollback notes', () => {
    const template = read('.github/pull_request_template.md');

    expect(template).toContain('## Linked User Stories');
    expect(template).toContain('US-11 Release-quality PR with checklist/evidence');
    expect(template).toContain('## Acceptance Verification');
    expect(template).toContain('## Validation Steps');
    expect(template).toContain('## Risks');
    expect(template).toContain('## Rollback Notes');
  });

  it('tracks local/CI evidence in dedicated checklist document', () => {
    const evidence = read('docs/PR_EVIDENCE.md');

    expect(evidence).toContain('# PR Validation Evidence (US-11)');
    expect(evidence).toContain('- [x] `npm run lint`');
    expect(evidence).toContain('- [x] `npm run typecheck`');
    expect(evidence).toContain('- [x] `npm run build`');
    expect(evidence).toContain('- [x] `npm run test`');
    expect(evidence).toContain('## CI Evidence');
    expect(evidence).toContain('## Rollback Plan');
  });
});
