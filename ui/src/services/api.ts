// The API client. Convention lifted from the workflow client (services/api.ts:29-56): a generic
// fetch wrapper that unwraps the server's `{ data, meta }` envelope. Extended for KIT-T131's
// typed guards — a 4xx carries `{ error: { code, message } }`, so a rejection (403 human_only,
// 422 evidence_floor, 409 not_writable) becomes an ApiError the UI surfaces inline rather than
// swallowing. All requests are same-origin (/api) — the Vite dev proxy forwards to the API.

import type {
  Me, ProjectSummary, ProjectPatchResult, TicketListItem, StoreItem, TicketDetail,
  WaitingGroup, CommentResult, StatusResult,
} from '../types';

const API_BASE = '/api';

// A typed server error. `code` is the guard discriminator (human_only | evidence_floor |
// not_writable | not_found | …); `message` is the human-readable guard text to show inline.
export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

interface Envelope<T> {
  data: T;
  meta?: Record<string, unknown>;
}

// Core request: parse the envelope on success, throw a typed ApiError on any non-2xx. A body that
// fails to parse still yields a meaningful ApiError (never a bare "unexpected token").
async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    const err = (body as { error?: { code?: string; message?: string } })?.error;
    throw new ApiError(response.status, err?.code ?? 'error', err?.message ?? `request failed (${response.status})`);
  }
  return (body as Envelope<T>).data;
}

// ---- reads ----
export const getMe = () => request<Me>('/me');
export const getProjects = () => request<ProjectSummary[]>('/projects');
export const getWaiting = () => request<WaitingGroup[]>('/waiting');

export function getTickets(key: string, status?: string) {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  return request<TicketListItem[]>(`/projects/${key}/tickets${query}`);
}

export function getTicket(key: string, id: string, agent?: string) {
  const query = agent ? `?agent=${encodeURIComponent(agent)}` : '';
  return request<TicketDetail>(`/projects/${key}/tickets/${id}${query}`);
}

export const getStore = (key: string, store: string) =>
  request<StoreItem[]>(`/projects/${key}/${store}`);

// ---- writes (markdown truth via the t.mjs code paths; a guard rejection is a typed ApiError) ----
export function postComment(key: string, id: string, payload: { text: string; author: string }) {
  return request<CommentResult>(`/projects/${key}/tickets/${id}/comments`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function postStatus(key: string, id: string, payload: { status: string; agent: string }) {
  return request<StatusResult>(`/projects/${key}/tickets/${id}/status`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function patchProject(key: string, payload: { displayName: string }) {
  return request<ProjectPatchResult>(`/projects/${key}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

// Fired after a project-meta write so live views (the Nav tabs) refetch without a reload.
export const PROJECTS_CHANGED_EVENT = 'kit:projects-changed';
export const announceProjectsChanged = () => window.dispatchEvent(new Event(PROJECTS_CHANGED_EVENT));
