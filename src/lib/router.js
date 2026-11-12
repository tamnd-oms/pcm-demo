import { useEffect, useState } from 'react';

// Hash router tối giản: #/p/:id/:tab?v=123  → { parts: ['p', id, tab], query: { v: '123' } }
function parse() {
  const hash = window.location.hash.replace(/^#/, '') || '/';
  const [path, qs = ''] = hash.split('?');
  return { path, parts: path.split('/').filter(Boolean), query: Object.fromEntries(new URLSearchParams(qs)) };
}

export function useRoute() {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const on = () => setRoute(parse());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export const navigate = (to) => { window.location.hash = to; };

/** Cập nhật query trên URL hiện tại (giữ link chia sẻ được). */
export function setQuery(patch) {
  const { path, query } = parse();
  const next = { ...query, ...patch };
  for (const k of Object.keys(next)) if (next[k] == null || next[k] === '') delete next[k];
  const qs = new URLSearchParams(next).toString();
  window.history.replaceState(null, '', `#${path}${qs ? `?${qs}` : ''}`);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}
