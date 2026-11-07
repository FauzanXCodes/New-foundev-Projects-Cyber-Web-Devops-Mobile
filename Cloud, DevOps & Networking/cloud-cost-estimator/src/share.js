/**
 * Shareable-URL state (pure, defensive).
 *
 * A workload is encoded as URL-safe base64 of its JSON. Decoding never throws:
 * malformed or tampered state yields null so the app can fall back cleanly.
 * Only configuration numbers and service ids are encoded - no personal data.
 */

import { isWorkloadLike, normalizeWorkload } from './state.js';

export const SHARE_PARAM = 's';
export const MAX_SHARE_TOKEN_LENGTH = 12_000;

function base64UrlEncode(text) {
  return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(text) {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  return atob(padded + pad);
}

/** Encode a workload into a compact URL-safe token. */
export function encodeState(workload) {
  return base64UrlEncode(JSON.stringify(normalizeWorkload(workload)));
}

/** Decode a token back into a normalized workload, or null if invalid. */
export function decodeState(token) {
  if (typeof token !== 'string' || token === '' || token.length > MAX_SHARE_TOKEN_LENGTH) {
    return null;
  }
  try {
    const parsed = JSON.parse(base64UrlDecode(token));
    return isWorkloadLike(parsed) ? normalizeWorkload(parsed) : null;
  } catch {
    return null;
  }
}

/** Build a shareable absolute URL for a workload, or null for an invalid base URL. */
export function buildShareUrl(workload, baseUrl) {
  try {
    const url = new URL(baseUrl);
    url.searchParams.set(SHARE_PARAM, encodeState(workload));
    return url.toString();
  } catch {
    return null;
  }
}

/** Extract a workload from a query string (e.g. location.search), or null. */
export function parseShareParam(search) {
  try {
    const params = new URLSearchParams(search ?? '');
    if (!params.has(SHARE_PARAM)) {
      return null;
    }
    return decodeState(params.get(SHARE_PARAM));
  } catch {
    return null;
  }
}

/** Does this query string carry a share token at all (valid or not)? */
export function hasShareParam(search) {
  try {
    return new URLSearchParams(search ?? '').has(SHARE_PARAM);
  } catch {
    return false;
  }
}

/** Feature-detect the native share sheet without depending on browser globals. */
export function canUseWebShare(navigatorLike) {
  return Boolean(navigatorLike && typeof navigatorLike.share === 'function');
}
