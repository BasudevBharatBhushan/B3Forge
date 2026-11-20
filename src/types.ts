export interface Options {
  command: string;
  target: string | null;
  profile: string;
  harnesses: Set<string>;
  dryRun: boolean;
  json: boolean;
  yes: boolean;
  writeConflicts: boolean;
  enableHooks: boolean;
  strict: boolean;
  mcp: boolean | undefined;
  graphPath: string;
  serverName: string;
  format: string;
  ticket: string | null;
  closing: boolean;
  port: number;
  handoffAction: string | null;
  help: boolean;
  version: boolean;
}

export interface FileRecord {
  kind: string;
  source: string;
  installedSha256: string;
}

export interface McpManaged {
  path: string;
  keys: string[];
  expectedValueSha256: string;
}

export interface InstallState {
  schemaVersion: number;
  template: { package: string; version: string; installedAt: string };
  target: { path: string; platform: string };
  profile: string;
  harnesses: string[];
  components: {
    baseWorkflow: boolean;
    graphifyMcp: boolean;
    hooks: boolean;
    review: boolean;
    securityScan: boolean;
    memory: boolean;
  };
  files: Record<string, FileRecord>;
  managedConfiguration: {
    gitignore: { path: string; lines: string[] };
    mcp?: McpManaged;
  };
}

export interface McpServerValue { command: string; args: string[] }

/** Parsed JSON config file, or `{ __error }` when it could not be read or parsed. */
export interface JsonFile {
  __error?: string;
  mcpServers?: Record<string, unknown>;
  [key: string]: unknown;
}

export type FileStatus = 'missing' | 'unchanged' | 'modified';

export type Action =
  | { op: 'write'; relative: string; source?: string; content: Buffer; reason: string }
  | { op: 'preserve'; relative: string; content?: Buffer; reason: string; conflict?: boolean }
  | { op: 'skip'; relative: string; reason: string }
  | { op: 'remove-file'; relative: string; reason: string }
  | { op: 'merge-mcp'; relative: string; name: string; value: McpServerValue; expectedHash: string; reason: string }
  | { op: 'remove-mcp'; relative: string; name: string; reason: string }
  | { op: 'preserve-config'; relative: string; reason: string }
  | { op: 'skip-config'; relative: string; reason: string }
  | { op: 'add-ignore'; relative: string; line: string; reason: string }
  | { op: 'remove-ignore'; relative: string; line: string; reason: string };

export type ExitError = Error & { code: number };
