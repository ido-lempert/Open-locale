import { Injectable } from '@angular/core';

export interface ProjectLocale { code: string; }
export interface Project {
  id: string; name: string; slug: string; description: string; baseLocale: string;
  locales: ProjectLocale[]; _count?: { keys: number };
}
export interface Translation { keyId: string; localeCode: string; value: string; }
export interface ApiTokenInfo {
  id: string; name: string; scopes: string[];
  lastUsedAt: string | null; expiresAt: string | null; createdAt: string;
}
export interface Key {
  id: string; name: string; description: string; isPlural: boolean; maxLength: number | null;
  translations: Translation[];
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
  login(email: string, password: string) {
    return this.request<{ accessToken: string }>('/auth/login', {
      method: 'POST', body: JSON.stringify({ email, password }),
    });
  }
  listProjects() { return this.request<Project[]>('/projects'); }
  createProject(input: { name: string; slug: string; description?: string; baseLocale?: string; locales: string[] }) {
    return this.request<Project>('/projects', { method: 'POST', body: JSON.stringify(input) });
  }
  getProject(id: string) { return this.request<Project>(`/projects/${id}`); }
  updateProject(id: string, input: { name?: string; description?: string }) {
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
  listKeys(projectId: string, search?: string) {
    const q = search ? `?search=${encodeURIComponent(search)}` : '';
    return this.request<Key[]>(`/projects/${projectId}/keys${q}`);
  }
  createKey(projectId: string, input: { name: string; description?: string }) {
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
  exportJson(projectId: string, locale: string) {
    return this.request<Record<string, unknown>>(`/projects/${projectId}/export/${locale}`);
  }
  importJson(projectId: string, locale: string, entries: Record<string, unknown>) {
    return this.request<{ keysCreated: number; translationsUpserted: number }>(
      `/projects/${projectId}/import/${locale}`,
      { method: 'POST', body: JSON.stringify({ locale, entries }) },
    );
  }
}
