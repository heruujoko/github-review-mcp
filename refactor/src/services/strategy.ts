/**
 * Strategy service: loads the catalog of review strategies from
 * `refactor/strategies/*.md`, parses skill-style frontmatter (gray-matter),
 * and resolves a repository's configured strategies against the catalog.
 *
 * Catalog loading is synchronous-once and cached. Repo-config resolution
 * (Phase 2.3) is added below.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as url from 'node:url';
import matter from 'gray-matter';
import yaml from 'js-yaml';
import type { IStrategyService, Strategy, ResolvedStrategies, RepoConfig } from '../types/index.js';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

/** Default catalog location: `refactor/strategies/`. */
const DEFAULT_CATALOG_DIR = path.resolve(__dirname, '../../strategies');

export interface StrategyServiceOptions {
  /** Directory holding `*.md` strategy files. Defaults to `refactor/strategies`. */
  catalogDir?: string;
}

/**
 * Loads and caches the review-strategy catalog and resolves per-repo
 * configurations against it.
 */
export class StrategyService implements IStrategyService {
  private readonly catalogDir: string;
  private catalogCache: Map<string, Strategy> | undefined;

  constructor(opts: StrategyServiceOptions = {}) {
    this.catalogDir = opts.catalogDir ?? DEFAULT_CATALOG_DIR;
    // Eager load so a broken catalog fails fast at boot.
    this.catalogCache = this.loadCatalog();
  }

  /** Returns the cached name→Strategy map. */
  getCatalog(): Map<string, Strategy> {
    return this.catalogCache as Map<string, Strategy>;
  }

  /**
   * Fetches `.github/review-config.yaml` from the repo (via the installation
   * Octokit), parses it, and intersects the repo's allowed strategy names
   * with the catalog.
   *
   * - Missing config file → fall back to `full-review` with a notice.
   * - Malformed YAML → fall back to `full-review` with a notice.
   * - Requested strategy absent from catalog → error listing available.
   * - Requested strategy present in catalog but not allowed by repo config
   *   → error listing the repo's allowed strategies.
   * - No request → returns all allowed strategies present in the catalog;
   *   if none match, falls back to `full-review` with a notice.
   */
  async resolveForRepo(
    octokit: unknown,
    owner: string,
    repo: string,
    requested?: string,
  ): Promise<ResolvedStrategies> {
    const catalog = this.getCatalog();
    const { config, reason } = await this.fetchRepoConfig(octokit, owner, repo);

    if (requested) {
      if (!catalog.has(requested)) {
        throw new Error(
          `Unknown strategy '${requested}'. Available strategies: ${[...catalog.keys()].join(', ')}.`,
        );
      }
      if (config && config.strategies.length > 0 && !config.strategies.includes(requested)) {
        throw new Error(
          `Strategy '${requested}' is not allowed by this repository's review-config.yaml. Allowed: ${config.strategies.join(', ')}.`,
        );
      }
      return { strategies: [catalog.get(requested) as Strategy] };
    }

    if (!config) {
      // Missing or unparseable config → fall back to full-review.
      const fallback = catalog.get('full-review');
      if (!fallback) {
        throw new Error(
          `No review-config.yaml found and no 'full-review' strategy exists in the catalog. Available: ${[...catalog.keys()].join(', ')}.`,
        );
      }
      return {
        strategies: [fallback],
        notice:
          reason === 'malformed'
            ? 'Malformed .github/review-config.yaml; falling back to the default strategy full-review.'
            : 'No .github/review-config.yaml found; falling back to the default strategy full-review.',
      };
    }

    const matched = config.strategies
      .filter((name) => catalog.has(name))
      .map((name) => catalog.get(name) as Strategy);
    const missing = config.strategies.filter((name) => !catalog.has(name));

    if (matched.length === 0) {
      const fallback = catalog.get('full-review');
      if (!fallback) {
        throw new Error(
          `None of the configured strategies (${config.strategies.join(', ')}) exist in the catalog, and no 'full-review' fallback exists.`,
        );
      }
      const notice =
        missing.length > 0
          ? `Configured strategies not in catalog: ${missing.join(', ')}. Falling back to full-review.`
          : 'No matching strategies found in the catalog. Falling back to full-review.';
      return { strategies: [fallback], notice };
    }

    const notice =
      missing.length > 0
        ? `Configured strategies not in catalog (ignored): ${missing.join(', ')}.`
        : undefined;
    return { strategies: matched, notice };
  }

  /** Fetches and parses `.github/review-config.yaml`; returns null on missing/malformed. */
  private async fetchRepoConfig(
    octokit: unknown,
    owner: string,
    repo: string,
  ): Promise<{ config: RepoConfig | null; reason?: 'missing' | 'malformed' }> {
    const api = octokit as {
      rest: {
        repos: {
          getContent(params: {
            owner: string;
            repo: string;
            path: string;
          }): Promise<{
            data:
              | { type: string; content?: string; encoding?: string }
              | Array<unknown>;
          }>;
        };
      };
    };
    const CONFIG_PATH = '.github/review-config.yaml';

    let data: { type: string; content?: string; encoding?: string } | null = null;
    try {
      const res = await api.rest.repos.getContent({ owner, repo, path: CONFIG_PATH });
      if (!Array.isArray(res.data) && res.data.type === 'file') {
        data = res.data;
      }
    } catch (err) {
      const status = (err as Error & { status?: number }).status;
      if (status === 404) return { config: null, reason: 'missing' };
      throw new Error(
        `Failed to read review-config.yaml from ${owner}/${repo}: ${(err as Error).message}`,
      );
    }
    if (!data) return { config: null, reason: 'missing' };

    const raw = data.content ?? '';
    const text = data.encoding === 'base64'
      ? Buffer.from(raw, 'base64').toString('utf8')
      : raw;
    try {
      const parsed = yaml.load(text) as Partial<RepoConfig> | null;
      return { config: this.normalizeConfig(parsed) };
    } catch {
      // Malformed YAML → signal fallback.
      return { config: null, reason: 'malformed' };
    }
  }

  private normalizeConfig(parsed: Partial<RepoConfig> | null): RepoConfig | null {
    if (!parsed) return null;
    const strategies = Array.isArray(parsed.strategies)
      ? (parsed.strategies as unknown[]).filter(
          (s): s is string => typeof s === 'string' && s.trim() !== '',
        )
      : [];
    return { strategies, default: parsed.default };
  }

  /** Loads and validates all `*.md` files from the catalog directory. */
  private loadCatalog(): Map<string, Strategy> {
    const catalog = new Map<string, Strategy>();
    let entries: string[];
    try {
      entries = fs
        .readdirSync(this.catalogDir)
        .filter((f) => f.endsWith('.md'))
        .sort();
    } catch (err) {
      throw new Error(
        `Could not read strategy catalog at ${this.catalogDir}: ${(err as Error).message}`,
      );
    }

    for (const file of entries) {
      const filePath = path.join(this.catalogDir, file);
      const raw = fs.readFileSync(filePath, 'utf8');
      let parsed: matter.GrayMatterFile<string>;
      try {
        parsed = matter(raw);
      } catch (err) {
        throw new Error(
          `Malformed frontmatter in strategy file ${file}: ${(err as Error).message}`,
        );
      }

      const data = parsed.data as Record<string, unknown>;
      const name = data.name;
      const description = data.description;

      if (typeof name !== 'string' || !name.trim()) {
        throw new Error(`Strategy file ${file} is missing a 'name' in frontmatter.`);
      }
      if (typeof description !== 'string' || !description.trim()) {
        throw new Error(
          `Strategy file ${file} is missing a 'description' in frontmatter.`,
        );
      }
      const body = parsed.content.trim();
      if (!body) {
        throw new Error(`Strategy file ${file} has an empty prompt body.`);
      }

      if (catalog.has(name)) {
        throw new Error(
          `Duplicate strategy name '${name}' found in ${file} (already defined elsewhere in the catalog).`,
        );
      }

      const strategy: Strategy = {
        name,
        description,
        triggers: Array.isArray(data.triggers)
          ? (data.triggers as string[])
          : undefined,
        priority:
          typeof data.priority === 'number' ? data.priority : undefined,
        body,
      };
      catalog.set(name, strategy);
    }

    return catalog;
  }
}