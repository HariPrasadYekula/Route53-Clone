import type { DnsRecord, Page, RecordInput, Tag, TestResult, User, Zone } from "./types";

/** Fired when any API call (other than the auth calls themselves) comes back 401, i.e. the session ended. */
export const UNAUTHORIZED_EVENT = "r53:unauthorized";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public field?: string | null,
    public index?: number | null,
  ) {
    super(message);
  }
}

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith("/auth/")) window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    const e = data?.error;
    throw new ApiError(res.status, e?.code ?? "Error", e?.message ?? "Something went wrong.", e?.field, e?.index);
  }
  return data as T;
}

type Param = string | number | undefined | null | string[];
const qs = (o: Record<string, Param>) => {
  const p = new URLSearchParams();
  Object.entries(o).forEach(([k, v]) => {
    if (Array.isArray(v)) v.forEach((x) => p.append(k, x));
    else if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
  });
  const s = p.toString();
  return s ? `?${s}` : "";
};
const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

export interface FilterParams { f: string[]; op: "and" | "or" }
interface ListParams extends FilterParams { page: number; page_size: number }

export const api = {
  me: () => req<User>("/auth/me"),
  login: (username: string, password: string, account?: string) => req<User>("/auth/login", json("POST", { username, password, account })),
  signup: (b: { username: string; password: string; account_name: string }) => req<User>("/auth/signup", json("POST", b)),
  logout: () => req<void>("/auth/logout", { method: "POST" }),
  zones: {
    list: (p: ListParams) => req<Page<Zone>>(`/hosted-zones${qs({ ...p })}`),
    get: (id: string) => req<Zone>(`/hosted-zones/${id}`),
    create: (b: { name: string; description: string; type: string; tags: Tag[]; vpc_id?: string; vpc_region?: string }) =>
      req<Zone>("/hosted-zones", json("POST", b)),
    update: (id: string, description: string) => req<Zone>(`/hosted-zones/${id}`, json("PATCH", { description })),
    remove: (id: string) => req<void>(`/hosted-zones/${id}`, { method: "DELETE" }),
    tags: (id: string) => req<Tag[]>(`/hosted-zones/${id}/tags`),
    setTags: (id: string, tags: Tag[]) => req<Tag[]>(`/hosted-zones/${id}/tags`, json("PUT", tags)),
  },
  records: {
    list: (zid: string, p: ListParams & { type?: string; routing_policy?: string; alias?: string }) =>
      req<Page<DnsRecord>>(`/hosted-zones/${zid}/records${qs({ ...p })}`),
    create: (zid: string, items: RecordInput[]) => req<DnsRecord[]>(`/hosted-zones/${zid}/records`, json("POST", items)),
    update: (zid: string, id: number, b: RecordInput) => req<DnsRecord>(`/hosted-zones/${zid}/records/${id}`, json("PUT", b)),
    importZoneFile: (zid: string, zone_file: string) => req<{ imported: number }>(`/hosted-zones/${zid}/records/import`, json("POST", { zone_file })),
    test: (zid: string, name: string, type: string) => req<TestResult>(`/hosted-zones/${zid}/records/test${qs({ name, type })}`),
    remove: (zid: string, ids: number[]) => req<{ deleted: number }>(`/hosted-zones/${zid}/records/bulk-delete`, json("POST", { ids })),
  },
  exportUrl: (zid: string, format: "json" | "bind") => `/api/hosted-zones/${zid}/export?format=${format}`,
};
