import { describe, it, expect } from 'vitest';
import {
  registerTool,
  getTool,
  toolDefinitions,
  resetRegistry,
} from './index.js';
import type { ToolEntry } from './index.js';
import type { ToolResult, ToolServices } from '../types/index.js';

const fakeEntry = (name: string): ToolEntry => ({
  definition: {
    name,
    description: `Tool ${name}`,
    inputSchema: { type: 'object', properties: {} },
  },
  handler: async () => ({ content: [{ type: 'text', text: 'ok' }] }) as ToolResult,
});

describe('tool registry', () => {
  // Ensure a clean slate regardless of other modules' side effects.
  resetRegistry();

  it('starts empty', () => {
    expect(toolDefinitions).toEqual([]);
    expect(getTool('nope')).toBeUndefined();
  });

  it('registerTool adds to definitions and lookup', () => {
    registerTool(fakeEntry('alpha'));
    expect(toolDefinitions).toHaveLength(1);
    expect(getTool('alpha')).toBeDefined();
    expect(getTool('alpha')!.definition.name).toBe('alpha');
  });

  it('prevents duplicate registration', () => {
    expect(() => registerTool(fakeEntry('alpha'))).toThrow(/already/);
  });

  it('handler can be invoked via the registry', async () => {
    const entry = getTool('alpha')!;
    const result = await entry.handler({} as Record<string, unknown>, {} as ToolServices);
    expect(result.content[0].text).toBe('ok');
  });

  it('resetRegistry clears all entries', () => {
    registerTool(fakeEntry('beta'));
    expect(toolDefinitions).toHaveLength(2);
    resetRegistry();
    expect(toolDefinitions).toEqual([]);
  });
});