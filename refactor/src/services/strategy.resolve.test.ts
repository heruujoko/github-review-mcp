import { describe, it, expect, vi, beforeAll } from 'vitest';
import * as path from 'node:path';
import * as url from 'node:url';
import * as fs from 'node:fs/promises';
import { StrategyService } from './strategy.js';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const FIXTURES = path.join(__dirname, '__fixtures__');
const cleanDir = path.join(FIXTURES, 'strategies-resolve-clean');

/** Minimal mock Octokit surface for `repos.getContent`. */
function octokitWithContent(yaml: string | { notFound: true } | { malformed: true }) {
  const get = vi.fn(async () => {
    if (yaml && typeof yaml === 'object' && 'notFound' in yaml) {
      const err = new Error('Not found');
      (err as Error & { status: number }).status = 404;
      throw err;
    }
    if (yaml && typeof yaml === 'object' && 'malformed' in yaml) {
      return {
        data: {
          type: 'file',
          encoding: 'base64',
          content: Buffer.from('strategies: [[unclosed').toString('base64'),
        },
      };
    }
    return {
      data: {
        type: 'file',
        encoding: 'base64',
        content: Buffer.from(yaml as string).toString('base64'),
      },
    };
  });
  return {
    rest: { repos: { getContent: get } },
    get,
  } as never;
}

const catalogYaml = (strategies: string[], def?: string) =>
  def
    ? `strategies:\n${strategies.map((s) => `  - ${s}`).join('\n')}\ndefault: ${def}\n`
    : `strategies:\n${strategies.map((s) => `  - ${s}`).join('\n')}\n`;

describe('StrategyService.resolveForRepo', () => {
  let cleanStrategies: StrategyService;

  beforeAll(async () => {
    await fs.rm(cleanDir, { recursive: true, force: true });
    await fs.mkdir(cleanDir, { recursive: true });
    await fs.writeFile(
      path.join(cleanDir, 'security.md'),
      '---\nname: security\ndescription: security review\n---\n\n# Security\nbody.\n',
    );
    await fs.writeFile(
      path.join(cleanDir, 'full-review.md'),
      '---\nname: full-review\ndescription: full review\n---\n\n# Full\nbody.\n',
    );
    await fs.writeFile(
      path.join(cleanDir, 'performance.md'),
      '---\nname: performance\ndescription: perf review\n---\n\n# Perf\nbody.\n',
    );
    cleanStrategies = new StrategyService({ catalogDir: cleanDir });
  });

  it('intersects repo strategies with the catalog', async () => {
    const ok = octokitWithContent(catalogYaml(['security', 'performance']));
    const result = await cleanStrategies.resolveForRepo(ok, 'o', 'r');
    const names = result.strategies.map((s) => s.name);
    expect(names).toContain('security');
    expect(names).toContain('performance');
    expect(result.strategies).toHaveLength(2);
    expect(result.notice).toBeUndefined();
  });

  it('omits configured strategies absent from the catalog, with a notice', async () => {
    const ok = octokitWithContent(catalogYaml(['security', 'nope-missing']));
    const result = await cleanStrategies.resolveForRepo(ok, 'o', 'r');
    const names = result.strategies.map((s) => s.name);
    expect(names).toEqual(['security']);
    expect(result.notice).toMatch(/nope-missing/);
  });

  it('falls back to full-review with a notice when config is missing', async () => {
    const ok = octokitWithContent({ notFound: true });
    const result = await cleanStrategies.resolveForRepo(ok, 'o', 'r');
    expect(result.strategies.map((s) => s.name)).toEqual(['full-review']);
    expect(result.notice).toMatch(/no.*config|fall/i);
  });

  it('falls back to full-review with a notice when YAML is malformed', async () => {
    const ok = octokitWithContent({ malformed: true });
    const result = await cleanStrategies.resolveForRepo(ok, 'o', 'r');
    expect(result.strategies.map((s) => s.name)).toEqual(['full-review']);
    expect(result.notice).toMatch(/malform|fall/i);
  });

  it('returns the requested strategy when allowed and present', async () => {
    const ok = octokitWithContent(catalogYaml(['security', 'performance']));
    const result = await cleanStrategies.resolveForRepo(ok, 'o', 'r', 'performance');
    expect(result.strategies.map((s) => s.name)).toEqual(['performance']);
  });

  it('errors when requested strategy is absent from the catalog', async () => {
    const ok = octokitWithContent(catalogYaml(['security']));
    await expect(
      cleanStrategies.resolveForRepo(ok, 'o', 'r', 'ghost'),
    ).rejects.toThrow(/available/i);
  });

  it('errors when requested strategy is not allowed by repo config', async () => {
    const ok = octokitWithContent(catalogYaml(['security'], 'security'));
    await expect(
      cleanStrategies.resolveForRepo(ok, 'o', 'r', 'performance'),
    ).rejects.toThrow(/not allowed|allowed/i);
  });

  it('uses config default when no strategy is requested and repo lists several', async () => {
    const ok = octokitWithContent(catalogYaml(['security', 'performance'], 'performance'));
    // No requested; default is performance → strategies filtered to catalog.
    const result = await cleanStrategies.resolveForRepo(ok, 'o', 'r');
    // With no explicit request, returns all allowed (intersected), not just default.
    const names = result.strategies.map((s) => s.name);
    expect(names).toContain('security');
    expect(names).toContain('performance');
  });

  it('falls back to full-review when repo lists strategies but none match catalog', async () => {
    const ok = octokitWithContent(catalogYaml(['unknown-1', 'unknown-2'], 'unknown-1'));
    const result = await cleanStrategies.resolveForRepo(ok, 'o', 'r');
    expect(result.strategies.map((s) => s.name)).toEqual(['full-review']);
    expect(result.notice).toMatch(/fall/i);
  });
});

