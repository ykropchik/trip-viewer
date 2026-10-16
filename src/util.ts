import type { Place, Trip } from './schema';

const d = (iso: string) => new Date(iso + 'T00:00:00');
const wdShort = new Intl.DateTimeFormat('ru-RU', { weekday: 'short' });
const wdLong = new Intl.DateTimeFormat('ru-RU', { weekday: 'long' });
const dayMonth = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' });

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** «Пт 7» */
export const chipLabel = (iso: string) => `${cap(wdShort.format(d(iso)))} ${d(iso).getDate()}`;
/** «7 мая, пятница» */
export const longDate = (iso: string) => `${dayMonth.format(d(iso))}, ${wdLong.format(d(iso))}`;
/** «7–18 мая 2027» or «28 апреля – 3 мая 2027» */
export function dateRange(a: string, b: string) {
  const A = d(a), B = d(b);
  const sameMonth = A.getMonth() === B.getMonth() && A.getFullYear() === B.getFullYear();
  if (sameMonth) return `${A.getDate()}–${dayMonth.format(B)} ${B.getFullYear()}`;
  return `${dayMonth.format(A)} – ${dayMonth.format(B)} ${B.getFullYear()}`;
}

export const nightsBetween = (a: string, b: string) => Math.round((d(b).getTime() - d(a).getTime()) / 86400000);

export function nightsWord(n: number) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return `${n} ночь`;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return `${n} ночи`;
  return `${n} ночей`;
}

export const gmapsUrl = (p: Place) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.query || p.name)}`;

export function money(n: number, currency = 'USD') {
  try {
    return new Intl.NumberFormat('ru-RU', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);
  } catch {
    return `${n} ${currency}`;
  }
}

export function budgetTotals(t: Trip) {
  const items = t.budget?.items ?? [];
  return items.reduce((a, i) => ({ min: a.min + i.min, max: a.max + i.max }), { min: 0, max: 0 });
}

/** Days that visit a place, in trip order. */
export const daysWithPlace = (t: Trip, placeId: string) => t.days.filter(day => day.stops.some(s => s.place === placeId));

export function downloadJson(name: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2) + '\n'], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
