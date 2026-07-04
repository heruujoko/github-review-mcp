import { describe, it, expect, beforeEach } from 'vitest';
import * as path from 'node:path';
import * as url from 'node:url';
import * as fs from 'node:fs/promises';
import { StrategyService } from './strategy.js';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const FIXTURES = path.join(__dirname, '__fixtures__');

describe('StrategyService catalog loading', () => {
  const cleanDir = path.join(FIXTURES, 'strategies-catalog-clean');

  beforeEach(async () => {
    await fs.rm(cleanDir, { recursive: true, force: true });
    await fs.mkdir(cleanDir, { recursive: true });
    await fs.writeFile(
      path.join(cleanDir, 'security.md'),
      '---\nname: security\ndescription: security review\ntriggers:\n  - secrets\npriority: 2\n---\n\n# Security\nBody text.\n',
    );
    await fs.writeFile(
      path.join(cleanDir, 'performance.md'),
      '---\nname: performance\ndescription: perf review\n---\n\n# Perf\nBody.\n',
    );
  });

  it('parses frontmatter metadata and body', () => {
    const svc = new StrategyService({ catalogDir: cleanDir });
    const catalog = svc.getCatalog();
    expect(catalog.size).toBe(2);
    const security = catalog.get('security');
    expect(security?.description).toBe('security review');
    expect(security?.triggers).toEqual(['secrets']);
    expect(security?.priority).toBe(2);
    expect(security?.body).toContain('# Security');
    expect(security?.body).toContain('Body text.');
    const perf = catalog.get('performance');
    expect(perf?.name).toBe('performance');
    expect(perf?.body).toMatch(/# Perf/);
    expect(perf?.triggers).toBeUndefined();
  });

  it('errors on duplicate strategy names', () => {
    expect(
      () =>
        new StrategyService({
          catalogDir: path.join(FIXTURES, 'strategies'),
        }),
    ).toThrow(/duplicate/i);
  });

  it('errors on malformed frontmatter', () => {
    expect(
      () =>
        new StrategyService({
          catalogDir: path.join(FIXTURES, 'malformed-catalog'),
        }),
    ).toThrow();
  });

  it('errors on a strategy with an empty body', () => {
    expect(
      () =>
        new StrategyService({
          catalogDir: path.join(FIXTURES, 'empty-body-catalog'),
        }),
    ).toThrow(/body/i);
  });

  it('caches the catalog on first load (same map reference)', () => {
    const svc = new StrategyService({ catalogDir: cleanDir });
    const first = svc.getCatalog();
    const second = svc.getCatalog();
    expect(first).toBe(second);
  });
});