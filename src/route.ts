import { useEffect, useState } from 'react';

/** Hash routes: #/t/<id>, #/t/<id>/<YYYY-MM-DD>, #/compare/<a>/<b>. */
export type Route =
  | { view: 'trip'; id?: string; date?: string }
  | { view: 'compare'; a?: string; b?: string };

export function parse(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  if (parts[0] === 'compare') return { view: 'compare', a: parts[1], b: parts[2] };
  if (parts[0] === 't') return { view: 'trip', id: parts[1], date: parts[2] };
  return { view: 'trip' };
}

export function href(r: Route) {
  if (r.view === 'compare') return `#/compare/${r.a ?? ''}/${r.b ?? ''}`.replace(/\/+$/, '');
  return r.id ? `#/t/${r.id}${r.date ? '/' + r.date : ''}` : '#/';
}

export function go(r: Route) {
  location.hash = href(r);
}

export function useRoute() {
  const [route, setRoute] = useState(() => parse(location.hash));
  useEffect(() => {
    const on = () => setRoute(parse(location.hash));
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}
