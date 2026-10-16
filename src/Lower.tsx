import type { Trip } from './schema';
import { store } from './storage';
import { budgetTotals, money } from './util';

export function Bookings({ trip }: { trip: Trip }) {
  if (!trip.bookings.length) return null;
  const today = new Date().toISOString().slice(0, 10);
  const items = [...trip.bookings].sort((a, b) => Number(a.done) - Number(b.done) || (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999'));
  const left = trip.bookings.filter(b => !b.done).length;

  const toggle = (id: string, done: boolean) => {
    store.save({ ...trip, bookings: trip.bookings.map(b => (b.id === id ? { ...b, done } : b)) });
  };

  return (
    <div className="box">
      <div className="box-h">
        <h2>Что забронировать</h2>
        <span className="count">{left ? `осталось ${left} из ${trip.bookings.length}` : 'всё забронировано'}</span>
      </div>
      <ul className="bk">
        {items.map(b => {
          const overdue = !b.done && b.deadline && b.deadline < today;
          return (
            <li key={b.id} className={b.done ? 'done' : ''}>
              <input type="checkbox" id={`bk-${b.id}`} checked={b.done} onChange={e => toggle(b.id, e.target.checked)} />
              <label htmlFor={`bk-${b.id}`}>
                <span className="what">{b.what}</span>
                <span className={'when' + (overdue ? ' overdue' : '')}>{b.when}{overdue ? ' · срок прошёл' : ''}</span>
                {b.url && <a href={b.url} target="_blank" rel="noopener">Сайт ↗</a>}
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function Budget({ trip }: { trip: Trip }) {
  const b = trip.budget;
  if (!b || !b.items.length) return null;
  const t = budgetTotals(trip);
  return (
    <div className="box">
      <div className="box-h">
        <h2>Бюджет{trip.travelers === 2 ? ' на двоих' : trip.travelers > 2 ? ` на ${trip.travelers}` : ''}</h2>
      </div>
      {b.note && <p className="muted small">{b.note}</p>}
      <div className="tbl-wrap">
        <table>
          <thead>
            <tr><th>Статья</th><th className="n">Минимум</th><th className="n">Комфорт</th></tr>
          </thead>
          <tbody>
            {b.items.map((i, k) => (
              <tr key={k}>
                <td>{i.what}{i.how && <small>{i.how}</small>}</td>
                <td className="n">{money(i.min, b.currency)}</td>
                <td className="n">{money(i.max, b.currency)}</td>
              </tr>
            ))}
            <tr className="total"><td>Итого</td><td className="n">{money(t.min, b.currency)}</td><td className="n">{money(t.max, b.currency)}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
