import { Injectable } from '@angular/core';

export interface ProjectLocale { code: string; }
export interface Project {
  id: string; name: string; slug: string; description: string; baseLocale: string;
  locales: ProjectLocale[]; customStatuses?: string[]; embedOrigins?: string[]; _count?: { keys: number };
}
export type TranslationStatus = string; // base UNVERIFIED/TRANSLATED/REVIEWED + project custom statuses
export interface Translation { keyId: string; localeCode: string; value: string; status: TranslationStatus; version?: number; }
export interface HistoryEntry {
  id: string; keyId: string; localeCode: string; value: string;
  status: TranslationStatus; createdAt: string;
  changedBy: { displayName: string; email: string } | null;
}
export interface ApiTokenInfo {
  id: string; name: string; scopes: string[];
  lastUsedAt: string | null; expiresAt: string | null; createdAt: string;
}
export interface Key {
  id: string; name: string; description: string; isPlural: boolean; maxLength: number | null;
  tags: string[];
  translations: Translation[];
  _count?: { comments: number; screenshots?: number };
}
export interface LocaleProgress { locale: string; base: boolean; total: number; translated: number; untranslated: number; percent: number; byStatus: Record<string, number>; }
export interface ProgressReport { branch: string; totalKeys: number; locales: LocaleProgress[]; }

export interface AutomationRuleInfo {
  id: string; name: string; trigger: string; action: string;
  config: Record<string, unknown>; enabled: boolean; createdAt: string;
}
export interface MtProviderInfo {
  id: string; name: string; type: string; enabled: boolean; createdAt: string;
}
export interface MtPretranslateResult {
  translated: number; skippedExisting: number; skippedNoSource: number; totalKeys: number;
}
export interface OtaPublicationInfo { id: string; version: number; branch: string; createdAt: string; locales: string[]; translations: number; }

export interface BranchInfo { id: string; name: string; createdAt: string; _count?: { keys: number }; }

export interface MemberInfo {
  id: string;
  displayName: string;
  email: string;
  role: string;
  allowedLocales: string[];
}

export interface SnapshotMeta {
  id: string;
  label: string;
  automatic: boolean;
  createdAt: string;
  keyCount: number;
  translationCount: number;
}

export interface ActivityEntry {
  id: string;
  action: string;
  keyName: string | null;
  localeCode: string | null;
  detail: Record<string, unknown> | null;
  createdAt: string;
  actor: { displayName: string; email: string } | null;
}

export interface TmSuggestion { sourceText: string; targetText: string; score: number; }

export interface QaIssue {
  keyId: string; key: string; locale: string;
  type: 'untranslated' | 'placeholder_mismatch' | 'max_length';
  detail: string;
}

export interface GlossaryTermItem {
  id: string; term: string; notes: string; doNotTranslate: boolean;
  translations: Record<string, string>; createdAt: string;
}

export interface TaskItem {
  id: string; title: string; description: string; status: 'OPEN' | 'IN_PROGRESS' | 'DONE';
  dueDate: string | null; createdAt: string;
  assignee: { id: string; displayName: string; email: string } | null;
  creator: { id: string; displayName: string; email: string } | null;
}
export interface LocaleProgress { locale: string; base: boolean; total: number; translated: number; untranslated: number; percent: number; byStatus: Record<string, number>; }
export interface ProgressReport { branch: string; totalKeys: number; locales: LocaleProgress[]; }

export interface OtaPublicationInfo { id: string; version: number; branch: string; createdAt: string; locales: string[]; translations: number; }

export interface BranchInfo { id: string; name: string; createdAt: string; _count?: { keys: number }; }

export interface MemberInfo { id: string; displayName: string; email: string; role: string; }

export interface ScreenshotMeta {
  id: string; filename: string; mimeType: string; byteSize: number; createdAt: string;
  uploader: { displayName: string; email: string } | null;
}

export interface CommentEntry {
  id: string; keyId: string; localeCode: string | null; body: string; createdAt: string;
  author: { displayName: string; email: string } | null;
}

const TOKEN_KEY = 'ol_token';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private base = '/api';

  get token(): string | null { return localStorage.getItem(TOKEN_KEY); }
  set token(value: string | null) {
    if (value) localStorage.setItem(TOKEN_KEY, value);
    else localStorage.removeItem(TOKEN_KEY);
  }

  private async raw<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {};
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    const res = await fetch(`${this.base}${path}`, { ...init, headers });
    if (res.status === 401) { this.token = null; throw new Error('Unauthorized'); }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error((body as { message?: string | string[] }).message?.toString() ?? `HTTP ${res.status}`);
    }
    return res.json() as Promise<T>;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    const res = await fetch(`${this.base}${path}`, { ...init, headers });
    if (res.status === 401) { this.token = null; throw new Error('Unauthorized'); }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error((body as { message?: string | string[] }).message?.toString() ?? `HTTP ${res.status}`);
    }
    return res.json() as Promise<T>;
  }

  listTokens() { return this.request<ApiTokenInfo[]>('/auth/tokens'); }
  get2faStatus() { return this.request<{ enabled: boolean; recoveryCodesRemaining: number }>('/auth/2fa/status'); }
  setup2fa(password: string) { return this.request<{ secret: string; otpauthUrl: string }>('/auth/2fa/setup', { method: 'POST', body: JSON.stringify({ password }) }); }
  enable2fa(password: string, code: string) { return this.request<{ enabled: boolean; recoveryCodes: string[] }>('/auth/2fa/enable', { method: 'POST', body: JSON.stringify({ password, code }) }); }
  disable2fa(password: string, code: string) { return this.request<{ enabled: boolean }>('/auth/2fa/disable', { method: 'POST', body: JSON.stringify({ password, code }) }); }
  createToken(name: string, scopes: string[]) {
    return this.request<{ id: string; name: string; token: string }>('/auth/tokens', {
      method: 'POST', body: JSON.stringify({ name, scopes }),
    });
  }
  revokeToken(id: string) {
    return this.request<{ revoked: string }>(`/auth/tokens/${id}`, { method: 'DELETE' });
  }
  signup(email: string, password: string, displayName: string) {
    return this.request<{ accessToken: string }>('/auth/signup', {
      method: 'POST', body: JSON.stringify({ email, password, displayName }),
    });
  }
  login(email: string, password: string, totpCode?: string) {
    return this.request<{ accessToken: string }>('/auth/login', {
      method: 'POST', body: JSON.stringify({ email, password, ...(totpCode ? { totpCode } : {}) }),
    });
  }
  listProjects() { return this.request<Project[]>('/projects'); }
  createProject(input: { name: string; slug: string; description?: string; baseLocale?: string; locales: string[] }) {
    return this.request<Project>('/projects', { method: 'POST', body: JSON.stringify(input) });
  }
  getProject(id: string) { return this.request<Project>(`/projects/${id}`); }
  updateProject(id: string, input: { name?: string; description?: string; customStatuses?: string[]; embedOrigins?: string[] }) {
    return this.request<Project>(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
  }
  deleteProject(id: string) {
    return this.request<{ removed: string }>(`/projects/${id}`, { method: 'DELETE' });
  }
  addLocale(projectId: string, code: string) {
    return this.request<ProjectLocale>(`/projects/${projectId}/locales`, { method: 'POST', body: JSON.stringify({ code }) });
  }
  removeLocale(projectId: string, code: string) {
    return this.request<{ removed: string }>(`/projects/${projectId}/locales/${code}`, { method: 'DELETE' });
  }
  listKeys(projectId: string, filters: { search?: string; tag?: string; status?: string; locale?: string; branch?: string } = {}) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) if (v) params.set(k, v);
    const q = params.toString();
    return this.request<Key[]>(`/projects/${projectId}/keys${q ? `?${q}` : ''}`);
  }
  getProgress(projectId: string, branch?: string) {
    return this.request<ProgressReport>(`/projects/${projectId}/reports/progress${branch ? `?branch=${encodeURIComponent(branch)}` : ''}`);
  }
  listAutomationRules(projectId: string) {
    return this.request<AutomationRuleInfo[]>(`/projects/${projectId}/automations`);
  }
  createAutomationRule(projectId: string, rule: { name: string; trigger: string; action: string; config: Record<string, unknown> }) {
    return this.request<AutomationRuleInfo>(`/projects/${projectId}/automations`, { method: 'POST', body: JSON.stringify(rule) });
  }
  updateAutomationRule(projectId: string, ruleId: string, patch: { enabled?: boolean }) {
    return this.request<AutomationRuleInfo>(`/projects/${projectId}/automations/${ruleId}`, { method: 'PATCH', body: JSON.stringify(patch) });
  }
  deleteAutomationRule(projectId: string, ruleId: string) {
    return this.request<{ deleted: boolean }>(`/projects/${projectId}/automations/${ruleId}`, { method: 'DELETE' });
  }
  listMtProviders(projectId: string) {
    return this.request<MtProviderInfo[]>(`/projects/${projectId}/mt/providers`);
  }
  createMtProvider(projectId: string, name: string, type: string) {
    return this.request<MtProviderInfo>(`/projects/${projectId}/mt/providers`, { method: 'POST', body: JSON.stringify({ name, type }) });
  }
  updateMtProvider(projectId: string, providerId: string, patch: { enabled?: boolean }) {
    return this.request<MtProviderInfo>(`/projects/${projectId}/mt/providers/${providerId}`, { method: 'PATCH', body: JSON.stringify(patch) });
  }
  deleteMtProvider(projectId: string, providerId: string) {
    return this.request<{ deleted: boolean }>(`/projects/${projectId}/mt/providers/${providerId}`, { method: 'DELETE' });
  }
  pretranslate(projectId: string, providerId: string, locale: string, branch?: string) {
    return this.request<MtPretranslateResult>(`/projects/${projectId}/mt/pretranslate`, { method: 'POST', body: JSON.stringify({ providerId, locale, ...(branch ? { branch } : {}) }) });
  }
  listOtaPublications(projectId: string) {
    return this.request<OtaPublicationInfo[]>(`/projects/${projectId}/ota`);
  }
  publishOta(projectId: string, branch?: string) {
    return this.request<OtaPublicationInfo>(`/projects/${projectId}/ota/publish`, { method: 'POST', body: JSON.stringify(branch ? { branch } : {}) });
  }
  listBranches(projectId: string) {
    return this.request<BranchInfo[]>(`/projects/${projectId}/branches`);
  }
  createBranch(projectId: string, name: string) {
    return this.request<BranchInfo>(`/projects/${projectId}/branches`, { method: 'POST', body: JSON.stringify({ name }) });
  }
  deleteBranch(projectId: string, branchId: string) {
    return this.request<{ removed: string; keysRemoved: number }>(`/projects/${projectId}/branches/${branchId}`, { method: 'DELETE' });
  }
  previewMergeBranch(projectId: string, branchId: string, into: string) {
    return this.request<{ from: string; into: string; keysCreated: number; keysExisting: number; translationsAdded: number; translationsOverwritten: number; translationsIdentical: number; targetOnlyKeys: number; previewAt: string }>(
      `/projects/${projectId}/branches/${branchId}/merge/preview`, { method: 'POST', body: JSON.stringify({ into }) });
  }
  mergeBranch(projectId: string, branchId: string, into: string, previewedAt?: string) {
    return this.request<{ merged: string; keysMerged: number; translationsMerged: number; keysSkipped: number; translationsSkipped: number }>(
      `/projects/${projectId}/branches/${branchId}/merge`, { method: 'POST', body: JSON.stringify({ into, previewedAt }) });
  }
  listMembers(projectId: string) {
    return this.request<MemberInfo[]>(`/projects/${projectId}/members`);
  }
  addMember(projectId: string, email: string, role: string, allowedLocales: string[]) {
    return this.request<MemberInfo>(`/projects/${projectId}/members`, { method: 'POST', body: JSON.stringify({ email, role, allowedLocales }) });
  }
  updateMember(projectId: string, userId: string, input: { role?: string; allowedLocales?: string[] }) {
    return this.request<MemberInfo>(`/projects/${projectId}/members/${userId}`, { method: 'PATCH', body: JSON.stringify(input) });
  }
  removeMember(projectId: string, userId: string) {
    return this.request<{ removed: string }>(`/projects/${projectId}/members/${userId}`, { method: 'DELETE' });
  }
  listSnapshots(projectId: string) {
    return this.request<SnapshotMeta[]>(`/projects/${projectId}/snapshots`);
  }
  createSnapshot(projectId: string, label: string) {
    return this.request<SnapshotMeta>(`/projects/${projectId}/snapshots`, { method: 'POST', body: JSON.stringify({ label }) });
  }
  restoreSnapshot(projectId: string, snapshotId: string) {
    return this.request<{ restored: boolean; keysRemoved: number; valuesChanged: number }>(
      `/projects/${projectId}/snapshots/${snapshotId}/restore`, { method: 'POST' });
  }
  listActivity(projectId: string, opts: { action?: string; cursor?: string; limit?: number } = {}) {
    const params = new URLSearchParams();
    if (opts.action) params.set('action', opts.action);
    if (opts.cursor) params.set('cursor', opts.cursor);
    if (opts.limit) params.set('limit', String(opts.limit));
    const q = params.toString();
    return this.request<{ items: ActivityEntry[]; nextCursor: string | null }>(
      `/projects/${projectId}/activity${q ? `?${q}` : ''}`);
  }
  suggestTm(projectId: string, locale: string, source: string) {
    return this.request<{ suggestions: TmSuggestion[] }>(
      `/projects/${projectId}/tm/suggest?locale=${encodeURIComponent(locale)}&source=${encodeURIComponent(source)}`);
  }
  async exportCsv(projectId: string, locale: string, mode?: 'raw', branch?: string) {
    const params = new URLSearchParams();
    if (mode) params.set('mode', mode);
    if (branch) params.set('branch', branch);
    const qs = params.toString();
    const res = await fetch(`${this.base}/projects/${projectId}/export/${locale}/csv${qs ? `?${qs}` : ''}`, {
      headers: this.token ? { Authorization: `Bearer ${this.token}` } : {},
    });
    if (!res.ok) throw new Error(`Export failed (HTTP ${res.status})`);
    return res.text();
  }
  importCsv(projectId: string, locale: string, csv: string, branch?: string) {
    return this.request<{ keysCreated: number; translationsUpserted: number }>(
      `/projects/${projectId}/import/${locale}${branch ? `?branch=${encodeURIComponent(branch)}` : ''}`, { method: 'POST', body: JSON.stringify({ csv }) });
  }
  async exportText(projectId: string, locale: string, kind: 'android' | 'ios', branch?: string) {
    const res = await fetch(`${this.base}/projects/${projectId}/export/${locale}/${kind}${branch ? `?branch=${encodeURIComponent(branch)}` : ''}`, {
      headers: this.token ? { Authorization: `Bearer ${this.token}` } : {},
    });
    if (!res.ok) throw new Error(`Export failed (HTTP ${res.status})`);
    return res.text();
  }
  importPayload(projectId: string, locale: string, payload: Record<string, unknown>, branch?: string) {
    return this.request<{ keysCreated: number; translationsUpserted: number }>(
      `/projects/${projectId}/import/${locale}${branch ? `?branch=${encodeURIComponent(branch)}` : ''}`, { method: 'POST', body: JSON.stringify(payload) });
  }
  runQa(projectId: string, locale?: string) {
    return this.request<{ issues: QaIssue[] }>(`/projects/${projectId}/qa${locale ? `?locale=${locale}` : ''}`);
  }
  listGlossary(projectId: string) {
    return this.request<GlossaryTermItem[]>(`/projects/${projectId}/glossary`);
  }
  createGlossaryTerm(projectId: string, input: { term: string; notes?: string; doNotTranslate?: boolean; translations?: Record<string, string> }) {
    return this.request<GlossaryTermItem>(`/projects/${projectId}/glossary`, { method: 'POST', body: JSON.stringify(input) });
  }
  updateGlossaryTerm(projectId: string, termId: string, input: Record<string, unknown>) {
    return this.request<GlossaryTermItem>(`/projects/${projectId}/glossary/${termId}`, { method: 'PATCH', body: JSON.stringify(input) });
  }
  deleteGlossaryTerm(projectId: string, termId: string) {
    return this.request<{ removed: string }>(`/projects/${projectId}/glossary/${termId}`, { method: 'DELETE' });
  }
  listTasks(projectId: string, status?: string) {
    return this.request<TaskItem[]>(`/projects/${projectId}/tasks${status ? `?status=${status}` : ''}`);
  }
  createTask(projectId: string, input: { title: string; description?: string; dueDate?: string; assigneeId?: string }) {
    return this.request<TaskItem>(`/projects/${projectId}/tasks`, { method: 'POST', body: JSON.stringify(input) });
  }
  updateTask(projectId: string, taskId: string, input: Record<string, unknown>) {
    return this.request<TaskItem>(`/projects/${projectId}/tasks/${taskId}`, { method: 'PATCH', body: JSON.stringify(input) });
  }
  deleteTask(projectId: string, taskId: string) {
    return this.request<{ removed: string }>(`/projects/${projectId}/tasks/${taskId}`, { method: 'DELETE' });
  }
  listScreenshots(projectId: string, keyId: string) {
    return this.request<ScreenshotMeta[]>(`/projects/${projectId}/keys/${keyId}/screenshots`);
  }
  uploadScreenshot(projectId: string, keyId: string, file: File) {
    const form = new FormData();
    form.append('file', file);
    return this.raw<ScreenshotMeta>(`/projects/${projectId}/keys/${keyId}/screenshots`, { method: 'POST', body: form });
  }
  deleteScreenshot(projectId: string, keyId: string, screenshotId: string) {
    return this.request<{ removed: string }>(`/projects/${projectId}/keys/${keyId}/screenshots/${screenshotId}`, { method: 'DELETE' });
  }
  async screenshotUrl(projectId: string, keyId: string, screenshotId: string): Promise<string> {
    const headers: Record<string, string> = {};
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    const res = await fetch(`${this.base}/projects/${projectId}/keys/${keyId}/screenshots/${screenshotId}`, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return URL.createObjectURL(await res.blob());
  }
  listComments(projectId: string, keyId: string, locale?: string) {
    const q = locale ? `?locale=${encodeURIComponent(locale)}` : '';
    return this.request<CommentEntry[]>(`/projects/${projectId}/keys/${keyId}/comments${q}`);
  }
  addComment(projectId: string, keyId: string, body: string, locale?: string) {
    return this.request<CommentEntry>(`/projects/${projectId}/keys/${keyId}/comments`, {
      method: 'POST', body: JSON.stringify({ body, ...(locale ? { locale } : {}) }),
    });
  }
  deleteComment(projectId: string, keyId: string, commentId: string) {
    return this.request<{ removed: string }>(`/projects/${projectId}/keys/${keyId}/comments/${commentId}`, { method: 'DELETE' });
  }
  setTags(projectId: string, keyId: string, tags: string[]) {
    return this.request<Key>(`/projects/${projectId}/keys/${keyId}/tags`, {
      method: 'PATCH', body: JSON.stringify({ tags }),
    });
  }
  createKey(projectId: string, input: { name: string; description?: string; branch?: string }) {
    return this.request<Key>(`/projects/${projectId}/keys`, { method: 'POST', body: JSON.stringify(input) });
  }
  deleteKey(projectId: string, keyId: string) {
    return this.request<{ removed: string }>(`/projects/${projectId}/keys/${keyId}`, { method: 'DELETE' });
  }
  upsertTranslation(projectId: string, keyId: string, locale: string, value: string) {
    return this.request<Translation>(`/projects/${projectId}/keys/${keyId}/translations`, {
      method: 'PUT', body: JSON.stringify({ locale, value }),
    });
  }
  bulkSetStatus(projectId: string, input: { locale: string; status: string; from?: string; search?: string; tag?: string; branch?: string; dryRun?: boolean; notChangedSince?: string }) {
    return this.request<{ matched: number; updated: number; previewAt: string | null }>(`/projects/${projectId}/review/bulk-status`, { method: 'POST', body: JSON.stringify(input) });
  }
  setStatus(projectId: string, keyId: string, locale: string, status: TranslationStatus) {
    return this.request<Translation>(`/projects/${projectId}/keys/${keyId}/translations/${locale}/status`, {
      method: 'PATCH', body: JSON.stringify({ status }),
    });
  }
  getHistory(projectId: string, keyId: string, locale: string) {
    return this.request<HistoryEntry[]>(`/projects/${projectId}/keys/${keyId}/translations/${locale}/history`);
  }
  exportJson(projectId: string, locale: string, branch?: string) {
    return this.request<Record<string, unknown>>(`/projects/${projectId}/export/${locale}${branch ? `?branch=${encodeURIComponent(branch)}` : ''}`);
  }
  importJson(projectId: string, locale: string, entries: Record<string, unknown>) {
    return this.request<{ keysCreated: number; translationsUpserted: number }>(
      `/projects/${projectId}/import/${locale}`,
      { method: 'POST', body: JSON.stringify({ locale, entries }) },
    );
  }
}
