/**
 * Tool registry — typed catalogue of MCP tools available to the server.
 *
 * Each tool registers a `{ definition, handler }` entry. The server's
 * `ListTools` handler iterates `toolDefinitions`; the `CallTool` handler
 * looks up the entry in `getTool` and invokes the handler with the resolved
 * service bundle.
 *
 * Keeping the registry a mutable singleton (rather than a frozen map) lets
 * individual tool modules self-register at import time: the server imports
 * `./tools/index.js` (which in turn imports each tool module) and the
 * registry is populated as a side effect.
 */

import type {
  ToolDefinition,
  ToolResult,
  ToolServices,
} from '../types/index.js';

/**
 * Synchronous handler invoked by `CallTool` with the typed args object and
 * the resolved service bundle. Handlers must:
 *   - enforce the repo allowlist before any GitHub call;
 *   - return a `ToolResult` envelope (`{ content: [{ type: 'text', text }] }`);
 *   - set `isError: true` on user-facing errors (allowlist, bad args, etc.).
 */
export type ToolHandler = (
  args: Record<string, unknown>,
  services: ToolServices,
) => Promise<ToolResult>;

export interface ToolEntry {
  definition: ToolDefinition;
  handler: ToolHandler;
}

const registry = new Map<string, ToolEntry>();

/**
 * Ordered list of tool definitions registered so far.
 * Reassign on each access so callers always see the current snapshot.
 */
export const toolDefinitions: ToolDefinition[] = [];

/**
 * Register a tool. Throws if a tool with the same name is already registered.
 */
export function registerTool(entry: ToolEntry): void {
  if (registry.has(entry.definition.name)) {
    throw new Error(
      `Tool '${entry.definition.name}' is already registered`,
    );
  }
  registry.set(entry.definition.name, entry);
  toolDefinitions.push(entry.definition);
}

/**
 * Look up a tool by name. Returns `undefined` when not found.
 */
export function getTool(name: string): ToolEntry | undefined {
  return registry.get(name);
}

/**
 * Clears every registered tool. Intended for tests that need an isolated
 * registry; production code never calls this.
 */
export function resetRegistry(): void {
  registry.clear();
  toolDefinitions.length = 0;
}
