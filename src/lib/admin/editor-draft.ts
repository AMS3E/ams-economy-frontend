// Local, device-only recovery for article edits. This deliberately does not
// autosave to WordPress: opening the new-article screen must never create a
// production draft without an explicit editor action.

export interface DraftData {
  title: string;
  body: string;
  status: string;
  password: string;
  sticky: boolean;
  categories: number[];
  tags: { id: number; name: string }[];
  featuredId: number;
  featuredThumb: string;
  excerpt: string;
  slug: string;
  seo: { title: string; description: string; focus: string };
}

export interface ArticleDraft {
  v: 1;
  at: number;
  data: DraftData;
}

const PREFIX = "ams-admin:article-backup:";

export function draftKey(postId: number | null): string {
  return `${PREFIX}${postId ?? "new"}`;
}

export function readDraft(key: string): ArticleDraft | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const draft = JSON.parse(raw) as ArticleDraft;
    if (
      draft?.v !== 1 ||
      typeof draft.at !== "number" ||
      typeof draft.data?.title !== "string" ||
      typeof draft.data?.body !== "string" ||
      !Array.isArray(draft.data?.categories)
    ) return null;
    return draft;
  } catch {
    return null;
  }
}

export function writeDraft(key: string, data: DraftData): void {
  try {
    localStorage.setItem(key, JSON.stringify({ v: 1, at: Date.now(), data } satisfies ArticleDraft));
  } catch {
    // Storage can be unavailable in private mode; editing must still work.
  }
}

export function clearDraft(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore unavailable storage.
  }
}

export function pruneDrafts(maxAgeDays = 30): void {
  try {
    const cutoff = Date.now() - maxAgeDays * 86_400_000;
    const stale: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(PREFIX)) continue;
      const draft = readDraft(key);
      if (!draft || draft.at < cutoff) stale.push(key);
    }
    stale.forEach((key) => localStorage.removeItem(key));
  } catch {
    // Ignore unavailable storage.
  }
}

export function agoLabel(at: number): string {
  const minutes = Math.max(0, Math.round((Date.now() - at) / 60_000));
  if (minutes < 1) return "moments ago";
  if (minutes < 60) return minutes === 1 ? "a minute ago" : `${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours === 1 ? "an hour ago" : `${hours} hours ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}
