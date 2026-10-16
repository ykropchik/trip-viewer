import { useEffect, useRef } from 'react';
import type { Trip } from './schema';
import { chipLabel, dateRange, gmapsUrl, longDate, nightsBetween, nightsWord } from './util';
import { focusStay } from './MapView';

export function Overview({ trip }: { trip: Trip }) {
  return (
    <>
      <div className="eyebrow">Обзор · {dateRange(trip.start, trip.end)}</div>
      <h2>Где жить</h2>
      <p className="muted small">Пунктирные круги на карте — районы, где искать жильё. Нажмите на район, чтобы приблизить его.</p>
      <div className="stays">
        {trip.stays.map(s => (
          <button key={s.id} type="button" className="stay" onClick={() => focusStay(s.id)}>
            <span className="h">
              <span className="nm">{s.city} · {s.area}</span>
              <span className="nt">{dateRange(s.checkIn, s.checkOut).replace(/ \d{4}$/, '')} · {nightsWord(nightsBetween(s.checkIn, s.checkOut))}</span>
            </span>
            {s.hotel && <span className="hotel">Забронировано: {s.hotel}</span>}
            {s.why && <span className="why">{s.why}</span>}
            {s.alt && <span className="alt">{s.alt}</span>}
          </button>
        ))}
      </div>
    </>
  );
}

type DayProps = {
  trip: Trip;
  index: number;
  highlight: number | null;
  onHighlight: (i: number | null) => void;
  onSelectDay: (date: string | null) => void;
};

export function DayPlan({ trip, index, highlight, onHighlight, onSelectDay }: DayProps) {
  const day = trip.days[index];
  const stay = trip.stays.find(s => s.id === day.stay);
  const list = useRef<HTMLOListElement>(null);
  const prev = trip.days[index - 1], next = trip.days[index + 1];
  let n = 0;

  useEffect(() => {
    if (highlight == null) return;
    list.current?.querySelector(`[data-i="${highlight}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [highlight]);

  return (
    <>
      <div className="eyebrow">{longDate(day.date)} · день {index + 1} из {trip.days.length}</div>
      <h2>{day.title}</h2>
      {stay && (
        <div>
          <span className="stay-pill">Ночёвка: <b>{stay.city}, {stay.hotel || stay.area}</b></span>
        </div>
      )}
      <ol className="timeline" ref={list}>
        {day.timeline.map((it, i) => {
          if (it.move) {
            return (
              <li key={i} className="tl-move">
                <span className="mv-ico" aria-hidden="true">
                  <svg viewBox="0 0 16 16" width="12" height="12"><path d="M8 2v11M3.5 8.5 8 13l4.5-4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </span>
                <div className="body">
                  <span className="how">{it.time && <span className="t">{it.time} · </span>}{it.move}</span>
                  {it.duration && <span className="dur">{it.duration}</span>}
                </div>
              </li>
            );
          }
          const p = it.place ? trip.places[it.place] : null;
          const idx = p ? n++ : -1;
          const color = p ? trip.categories[p.category]?.color : undefined;
          return (
            <li
              key={i}
              className={'stop' + (idx >= 0 && idx === highlight ? ' hl' : '')}
              data-i={idx}
              onMouseEnter={() => idx >= 0 && onHighlight(idx)}
              onMouseLeave={() => idx >= 0 && onHighlight(null)}
            >
              {p ? <span className="num" style={{ background: color }}>{idx + 1}</span> : <span className="num none" />}
              <div className="body">
                {it.time && <div className="t">{it.time}</div>}
                {p && <div className="n">{p.name}</div>}
                <div className={p ? 'x' : 'n'}>{it.text}</div>
                {p && <a className="gm" href={gmapsUrl(p)} target="_blank" rel="noopener">Открыть в Google Maps ↗</a>}
              </div>
            </li>
          );
        })}
      </ol>
      {day.tip && <div className="tip">{day.tip}</div>}
      <div className="pager">
        <button className="btn" type="button" disabled={!prev} onClick={() => prev && onSelectDay(prev.date)}>← {prev ? chipLabel(prev.date) : ''}</button>
        <button className="btn" type="button" disabled={!next} onClick={() => next && onSelectDay(next.date)}>{next ? chipLabel(next.date) : ''} →</button>
      </div>
    </>
  );
}
