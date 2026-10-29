// Types for the core-workflow subset the SDK wraps. Not full API parity.
export interface ClientOptions { url: string; token: string; fetchImpl?: typeof fetch; }
export declare class OpenLocaleError extends Error {
  status: number; path: string;
  constructor(status: number, message: string, path: string);
}
export interface BranchOpts { branch?: string; }
export interface ImportSummary {
  locale: string; keysCreated: number; translationsUpserted: number;
  unchangedSkipped: number; failed: number; failures?: string[]; dryRun?: boolean;
}
export interface OpenLocaleClient {
  request: (path: string, opts?: { method?: string; body?: unknown; raw?: boolean }) => Promise<any>;
  projects: {
    list: () => Promise<any[]>;
    get: (projectId: string) => Promise<any>;
  };
  keys: {
    list: (projectId: string, opts?: { search?: string } & BranchOpts) => Promise<any[]>;
    create: (projectId: string, name: string, opts?: { description?: string } & BranchOpts) => Promise<any>;
  };
  translations: {
    get: (projectId: string, locale: string, opts?: BranchOpts) => Promise<Record<string, string>>;
    put: (projectId: string, keyId: string, locale: string, value: string, opts?: BranchOpts) => Promise<any>;
  };
  io: {
    importEntries: (projectId: string, locale: string, entries: Record<string, unknown>, opts?: BranchOpts & { dryRun?: boolean }) => Promise<ImportSummary>;
    exportText: (projectId: string, locale: string, format: string, opts?: BranchOpts) => Promise<string>;
  };
}
export declare function createClient(opts: ClientOptions): OpenLocaleClient;
