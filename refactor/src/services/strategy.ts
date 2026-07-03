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
import type { IStrategyService, Strategy, ResolvedStrategies } from '../types/index.js';

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
   * Resolves strategies for a repo against its `.github/review-config.yaml`.
   * Implemented in Phase 2.3.
   */
  async resolveForRepo(
    _octokit: unknown,
    _owner: string,
    _repo: string,
    _requested?: string,
  ): Promise<ResolvedStrategies> {
    throw new Error('resolveForRepo not yet implemented (Phase 2.3)');
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