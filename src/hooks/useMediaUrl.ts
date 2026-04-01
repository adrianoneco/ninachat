import { useState, useEffect, useRef } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE || '/api';

/** Cache of resolved presigned URLs keyed by the original media path */
const urlCache = new Map<string, { url: string; expires: number }>();
const CACHE_TTL = 7 * 60 * 60 * 1000; // 7h (URLs expire after 8h)

/**
 * Resolves a media_url which may be:
 * - A /api/storage/:id/url path → fetches the presigned URL
 * - An absolute http(s):// URL → returns as-is
 * - A /uploads/... legacy path → returns as-is
 * - A data: URL → returns as-is
 */
export function useMediaUrl(mediaUrl: string | null | undefined): string | null {
  const [resolved, setResolved] = useState<string | null>(() => {
    if (!mediaUrl) return null;
    const cached = urlCache.get(mediaUrl);
    if (cached && cached.expires > Date.now()) return cached.url;
    if (!isStoragePath(mediaUrl)) return mediaUrl;
    return null;
  });
  const lastUrl = useRef(mediaUrl);

  useEffect(() => {
    if (mediaUrl !== lastUrl.current) {
      lastUrl.current = mediaUrl;
      if (!mediaUrl) { setResolved(null); return; }
      const cached = urlCache.get(mediaUrl);
      if (cached && cached.expires > Date.now()) { setResolved(cached.url); return; }
      if (!isStoragePath(mediaUrl)) { setResolved(mediaUrl); return; }
      setResolved(null);
    }

    if (!mediaUrl || !isStoragePath(mediaUrl)) return;

    const cached = urlCache.get(mediaUrl);
    if (cached && cached.expires > Date.now()) {
      setResolved(cached.url);
      return;
    }

    let cancelled = false;
    resolveStorageUrl(mediaUrl).then(url => {
      if (!cancelled && url) {
        urlCache.set(mediaUrl, { url, expires: Date.now() + CACHE_TTL });
        setResolved(url);
      }
    });
    return () => { cancelled = true; };
  }, [mediaUrl]);

  return resolved;
}

function isStoragePath(url: string): boolean {
  return url.includes('/storage/') && url.includes('/url');
}

async function resolveStorageUrl(path: string): Promise<string | null> {
  try {
    // path is like /api/storage/:id/url — fetch it to get the presigned URL
    const fetchPath = path.startsWith('/api/') ? path : `${API_BASE}${path.startsWith('/') ? path : '/' + path}`;
    const res = await fetch(fetchPath);
    if (!res.ok) return null;
    const json = await res.json();
    return json?.url || null;
  } catch {
    return null;
  }
}
