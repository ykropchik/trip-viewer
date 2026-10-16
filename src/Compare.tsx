import { stopPlaces, type Trip } from './schema';
import { store } from './storage';
import { go } from './route';
import { budgetTotals, chipLabel, dateRange, money, nightsBetween, nightsWord } from './util';

function staysLine(t: Trip) {
  return t.stays.map(s => `${s.city} ${nightsBetween(s.checkIn, s.checkOut)}`).join(' · ') || '—';
}

function categoryCounts(t: Trip) {
  const visited = new Set(t.days.flatMap(stopPlaces));
  const out: Record<string, number> = {};
  visited.forEach(id => {
    const c = t.places[id]?.category;
    if (c) out[c] = (out[c] ?? 0) + 1;
  });
  return out;
}

export function Compare({ a, b }: { a?: string; b?: string }) {
  const list = store.list();
  const A = a ? store.get(a)?.trip : undefined;
  const B = b ? store.get(b)?.trip : undefined;

  const picker = (side: 'a' | 'b', value?: string) => (
    <select
      id={`cmp-${side}`}
      aria-label={side === 'a' ? 'Первая поездка' : 'Вторая поездка'}
      value={value ?? ''}
      onChange={e => go({ view: 'compare', a: side === 'a' ? e.target.value : a, b: side === 'b' ? e.target.value : b })}
    >
      <option value="" disabled>Выберите поездку</option>
      {list.map(e => <option key={e.trip.id} value={e.trip.id}>{e.trip.title}</option>)}
    </select>
  );

  return (
    <>
      <header className="top">
        <div className="title">
          <a className="back" href={A ? `#/t/${A.id}` : '#/'}>← К поездке</a>
          <h1>Сравнение поездок</h1>
        </div>
      </header>
      <div className="cmp-pick">
        {picker('a', a)}
        <span className="muted">и</span>
        {picker('b', b)}
      </div>
      {A && B ? <CompareTables A={A} B={B} /> : <p className="muted">Выберите две поездки, чтобы увидеть разницу.</p>}
    </>
  );
}

function CompareTables({ A, B }: { A: Trip; B: Trip }) {
  const tA = budgetTotals(A), tB = budgetTotals(B);
  const cats = { ...B.categories, ...A.categories };
  const cA = categoryCounts(A), cB = categoryCounts(B);
  const dates = [...new Set([...A.days.map(d => d.date), ...B.days.map(d => d.date)])].sort();
  const dayOf = (t: Trip, date: string) => t.days.find(d => d.date === date);
  const cityOf = (t: Trip, id?: string | null) => t.stays.find(s => s.id === id)?.city ?? '';
  const delta = (x: number, y: number, cur: string) => (y === x ? '' : `${y > x ? '+' : '−'}${money(Math.abs(y - x), cur)}`);
  const cur = A.budget?.currency ?? 'USD';

  const rows: [string, string, string, boolean][] = [
    ['Даты', dateRange(A.start, A.end), dateRange(B.start, B.end), A.start !== B.start || A.end !== B.end],
    ['Ночей', nightsWord(nightsBetween(A.start, A.end)), nightsWord(nightsBetween(B.start, B.end)), nightsBetween(A.start, A.end) !== nightsBetween(B.start, B.end)],
    ['Ночёвки', staysLine(A), staysLine(B), staysLine(A) !== staysLine(B)],
    ...Object.entries(cats).map(([k, c]) => [c.label, String(cA[k] ?? 0), String(cB[k] ?? 0), (cA[k] ?? 0) !== (cB[k] ?? 0)] as [string, string, string, boolean]),
    ['Бюджет', `${money(tA.min, cur)} – ${money(tA.max, cur)}`, `${money(tB.min, cur)} – ${money(tB.max, cur)}`, tA.min !== tB.min || tA.max !== tB.max],
  ];

  return (
    <div className="cmp">
      <div className="box">
        <h2>Коротко</h2>
        <div className="tbl-wrap">
          <table className="cmp-t">
            <thead><tr><th></th><th>{A.title}</th><th>{B.title}</th></tr></thead>
            <tbody>
              {rows.map(([k, x, y, diff]) => (
                <tr key={k} className={diff ? 'diff' : ''}><td className="k">{k}</td><td>{x}</td><td>{y}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        {(tA.max > 0 || tB.max > 0) && (
          <p className="muted small">
            Вторая поездка по бюджету: {delta(tA.min, tB.min, cur) || 'так же'} в минимуме, {delta(tA.max, tB.max, cur) || 'так же'} в комфорте.
          </p>
        )}
      </div>
      <div className="box">
        <h2>По дням</h2>
        <p className="muted small">Подсвечены дни, где планы различаются.</p>
        <div className="tbl-wrap">
          <table className="cmp-t days-t">
            <thead><tr><th>День</th><th>{A.title}</th><th>{B.title}</th></tr></thead>
            <tbody>
              {dates.map(date => {
                const x = dayOf(A, date), y = dayOf(B, date);
                const sig = (t: Trip, d?: typeof x) => (d ? d.title + '|' + cityOf(t, d.stay) + '|' + d.timeline.map(s => s.place ?? s.text ?? s.move).join(',') : '');
                const diff = sig(A, x) !== sig(B, y);
                const cell = (t: Trip, d?: typeof x) =>
                  d ? (
                    <a href={`#/t/${t.id}/${d.date}`}>
                      <b>{d.title}</b>
                      <small>{cityOf(t, d.stay) || 'без ночёвки'} · {stopPlaces(d).length} точ.</small>
                    </a>
                  ) : <span className="muted">—</span>;
                return (
                  <tr key={date} className={diff ? 'diff' : ''}>
                    <td className="k">{chipLabel(date)}</td>
                    <td>{cell(A, x)}</td>
                    <td>{cell(B, y)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
