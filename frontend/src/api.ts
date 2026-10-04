const BASE = "/api";

export interface Profile {
  id: number;
  name: string;
  created_at: string;
  transactions: number;
}

async function check(r: Response): Promise<Response> {
  if (!r.ok) {
    let msg = r.statusText;
    try {
      const j = await r.json();
      msg = j.detail || JSON.stringify(j);
    } catch {
      /* keep statusText */
    }
    throw new Error(msg);
  }
  return r;
}

export async function get<T>(path: string): Promise<T> {
  const r = await check(await fetch(BASE + path));
  return r.json();
}

export async function post(path: string, body?: unknown): Promise<any> {
  const r = await check(await fetch(BASE + path, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  }));
  return r.json();
}

export async function patch(path: string): Promise<unknown> {
  const r = await check(await fetch(BASE + path, { method: "PATCH" }));
  return r.json();
}

export async function del(path: string): Promise<unknown> {
  const r = await check(await fetch(BASE + path, { method: "DELETE" }));
  return r.json();
}

/** Append ?profile_id=… to a path (works with existing query strings). */
export function withProfile(path: string, profileId: number): string {
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}profile_id=${profileId}`;
}

export async function upload(file: File, profileId: number): Promise<any> {
  const fd = new FormData();
  fd.append("file", file);
  const r = await check(await fetch(BASE + `/upload?profile_id=${profileId}`, { method: "POST", body: fd }));
  return r.json();
}

export async function resetProfile(profileId: number): Promise<unknown> {
  const r = await check(await fetch(BASE + `/reset?profile_id=${profileId}`, { method: "POST" }));
  return r.json();
}

export const fmt = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Compact axis labels: 1500 -> "1.5k", 2000000 -> "2M". */
export const fmtCompact = (n: number) => {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return `${n}`;
};
