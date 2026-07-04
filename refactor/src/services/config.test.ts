import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConfigService } from './config.js';

describe('ConfigService', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  function setEnv(vars: Record<string, string | undefined>) {
    for (const [k, v] of Object.entries(vars)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }

  describe('construction / validation', () => {
    it('throws when a required variable is missing', () => {
      setEnv({
        GITHUB_APP_ID: undefined,
        GITHUB_APP_PRIVATE_KEY: undefined,
        MCP_API_SECRET: undefined,
      });
      expect(() => new ConfigService()).toThrow(/GITHUB_APP_ID/);
    });

    it('constructs when all required vars are present', () => {
      setEnv({
        GITHUB_APP_ID: '123456',
        GITHUB_APP_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\nkey\n-----END PRIVATE KEY-----',
        MCP_API_SECRET: 'super-secret',
        PORT: '4321',
        MAX_PATCH_SIZE: '999',
        MAX_FILES_TO_REVIEW: '7',
        REQUEST_TIMEOUT: '5000',
      });
      const cfg = new ConfigService();
      expect(cfg.githubAppId).toBe('123456');
      expect(cfg.port).toBe(4321);
      expect(cfg.maxPatchSize).toBe(999);
      expect(cfg.maxFilesToReview).toBe(7);
      expect(cfg.requestTimeout).toBe(5000);
    });

    it('uses defaults when optional vars are absent', () => {
      setEnv({
        GITHUB_APP_ID: '1',
        GITHUB_APP_PRIVATE_KEY: 'k',
        MCP_API_SECRET: 's',
        PORT: undefined,
        MAX_PATCH_SIZE: undefined,
        MAX_FILES_TO_REVIEW: undefined,
        REQUEST_TIMEOUT: undefined,
      });
      const cfg = new ConfigService();
      expect(cfg.port).toBe(3000);
      expect(cfg.maxPatchSize).toBeGreaterThan(0);
      expect(cfg.maxFilesToReview).toBeGreaterThan(0);
      expect(cfg.requestTimeout).toBeGreaterThan(0);
    });
  });

  describe('isRepoAllowed', () => {
    it('allows all repos when allowlist is empty', () => {
      setEnv({
        GITHUB_APP_ID: '1',
        GITHUB_APP_PRIVATE_KEY: 'k',
        MCP_API_SECRET: 's',
        REPO_ALLOWLIST: undefined,
      });
      const cfg = new ConfigService();
      expect(cfg.isRepoAllowed('any', 'repo')).toBe(true);
    });

    it('only allows repos present in the allowlist', () => {
      setEnv({
        GITHUB_APP_ID: '1',
        GITHUB_APP_PRIVATE_KEY: 'k',
        MCP_API_SECRET: 's',
        REPO_ALLOWLIST: 'octocat/Hello-World, foo/bar ',
      });
      const cfg = new ConfigService();
      expect(cfg.isRepoAllowed('octocat', 'Hello-World')).toBe(true);
      expect(cfg.isRepoAllowed('foo', 'bar')).toBe(true);
      expect(cfg.isRepoAllowed('foo', 'baz')).toBe(false);
      expect(cfg.isRepoAllowed('other', 'repo')).toBe(false);
    });
  });

  describe('toDebugObject masks secrets', () => {
    it('never reveals private key or api secret', () => {
      setEnv({
        GITHUB_APP_ID: '111',
        GITHUB_APP_PRIVATE_KEY: 'TOPSECRET',
        MCP_API_SECRET: 'DONOTLEAK',
        REPO_ALLOWLIST: 'a/b',
      });
      const cfg = new ConfigService();
      const dump = JSON.stringify(cfg.toDebugObject());
      expect(dump).not.toContain('TOPSECRET');
      expect(dump).not.toContain('DONOTLEAK');
      expect(dump).toContain('111');
    });
  });
});