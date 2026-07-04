import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import * as url from 'node:url';
import { StrategyService } from '../src/services/strategy.js';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const CATALOG = path.join(__dirname);

describe('seeded strategy catalog', () => {
  const svc = new StrategyService({ catalogDir: CATALOG });

  it('loads all five seeded strategies', () => {
    const names = [...svc.getCatalog().keys()].sort();
    expect(names).toEqual(
      ['architecture', 'full-review', 'minimal', 'performance', 'security'].sort(),
    );
  });

  for (const name of [
    'security',
    'performance',
    'architecture',
    'full-review',
    'minimal',
  ]) {
    it(`${name} has non-empty name, description, and body`, () => {
      const s = svc.getCatalog().get(name);
      expect(s).toBeDefined();
      expect(s!.name.trim().length).toBeGreaterThan(0);
      expect(s!.description.trim().length).toBeGreaterThan(0);
      expect(s!.body.trim().length).toBeGreaterThan(0);
    });
  }
});