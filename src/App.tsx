import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { store, useStoreVersion } from './storage';
import { go, useRoute } from './route';
import { budgetTotals, chipLabel, dateRange, downloadJson, money, nightsBetween, nightsWord } from './util';
import { MapView } from './MapView';
import { DayPlan, Overview } from './Panel';
import { Bookings, Budget } from './Lower';
import { ImportDialog } from './ImportDialog';
import { Compare } from './Compare';

export function App() {
  useStoreVersion();
  const route = useRoute();
  const [importOpen, setImportOpen] = useState(false);

  if (route.view === 'compare') {
    return (
      <div className="wrap">
        <Compare a={route.a} b={route.b} />
      </div>
    );
  }

  const id = route.id && store.has(route.id) ? route.id : store.active();
  const entry = id ? store.get(id) : undefined;

  if (!entry) {
    return (
      <div className="wrap">
        <div className="empty">
          <h1>Trip Viewer</h1>
          <p>В этом браузере пока нет поездок. Загрузите JSON поездки — формат описан в <a href="/trip.schema.json">trip.schema.json</a>.</p>
          <button className="btn primary" type="button" onClick={() => setImportOpen(true)}>Импортировать поездку</button>
        </div>
        {importOpen && <ImportDialog onClose={() => setImportOpen(false)} />}
      </div>
    );
  }

  return (
    <TripScreen
      key={entry.trip.id}
      tripId={entry.trip.id}
      date={route.date}
      onImport={() => setImportOpen(true)}
      importDialog={importOpen ? <ImportDialog onClose={() => setImportOpen(false)} /> : null}
    />
  );
}

function TripScreen(props: { tripId: string; date?: string; onImport: () => void; importDialog: ReactNode }) {
  const entry = store.get(props.tripId)!;
  const trip = entry.trip;
  const dayIndex = props.date ? trip.days.findIndex(d => d.date === props.date) : -1;
  const day = dayIndex >= 0 ? trip.days[dayIndex] : null;
  const [hl, setHl] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => store.setActive(trip.id), [trip.id]);
  useEffect(() => {
    setHl(null);
    document.querySelector('.chip[aria-pressed="true"]')?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [props.date]);

  const totals = useMemo(() => budgetTotals(trip), [trip]);
  const nights = nightsBetween(trip.start, trip.end);
  const select = (date: string | null) => go({ view: 'trip', id: trip.id, date: date ?? undefined });
  const others = store.list().filter(e => e.trip.id !== trip.id);

  return (
    <div className="wrap">
      <header className="top">
        <div className="title">
          <div className="trip-pick">
            <select
              id="trip-select"
              aria-label="Поездка"
              value={trip.id}
              onChange={e => go({ view: 'trip', id: e.target.value })}
            >
              {store.list().map(e => (
                <option key={e.trip.id} value={e.trip.id}>{e.trip.title}</option>
              ))}
            </select>
          </div>
          <h1>{trip.title}</h1>
          {trip.subtitle && <div className="sub">{trip.subtitle}</div>}
        </div>
        <div className="side">
          <div className="stats">
            <span className="stat"><b>{dateRange(trip.start, trip.end)}</b></span>
            <span className="stat"><b>{nightsWord(nights)}</b></span>
            {trip.budget && totals.max > 0 && (
              <span className="stat">
                <b>~{money(Math.round((totals.min + totals.max) / 2 / 50) * 50, trip.budget.currency)}</b>
                {trip.travelers > 1 ? ` на ${trip.travelers === 2 ? 'двоих' : trip.travelers + ' чел.'}` : ''}
              </span>
            )}
          </div>
          <div className="actions">
            <button className="btn" type="button" onClick={props.onImport}>Импорт</button>
            <button className="btn" type="button" onClick={() => downloadJson(`${trip.id}.json`, trip)}>Экспорт</button>
            <button
              className="btn"
              type="button"
              disabled={!others.length}
              title={others.length ? '' : 'Нужна вторая поездка'}
              onClick={() => go({ view: 'compare', a: trip.id, b: others[0]?.trip.id })}
            >
              Сравнить
            </button>
            {confirmDelete ? (
              <span className="confirm">
                Удалить «{trip.title}»?
                <button className="btn danger" type="button" onClick={() => { store.remove(trip.id); go({ view: 'trip' }); }}>Удалить</button>
                <button className="btn" type="button" onClick={() => setConfirmDelete(false)}>Отмена</button>
              </span>
            ) : (
              <button className="btn ghost" type="button" onClick={() => setConfirmDelete(true)}>Удалить</button>
            )}
          </div>
        </div>
      </header>

      <nav className="days" aria-label="Дни поездки">
        <button className="chip" type="button" aria-pressed={!day} onClick={() => select(null)}>
          <span className="d">Обзор</span>
          <span className="w">весь маршрут</span>
        </button>
        {trip.days.map(d => {
          const stay = trip.stays.find(s => s.id === d.stay);
          return (
            <button key={d.date} className="chip" type="button" aria-pressed={day?.date === d.date} onClick={() => select(d.date)}>
              <span className="d">{chipLabel(d.date)}</span>
              <span className="w">{stay ? stay.city : 'вылет'}</span>
            </button>
          );
        })}
      </nav>

      <main className="layout">
        <section className="map-card" aria-label="Карта">
          <MapView trip={trip} day={day} highlight={hl} onHighlight={setHl} onSelectDay={select} />
        </section>
        <aside className="panel" aria-live="polite">
          {day ? (
            <DayPlan
              trip={trip}
              index={dayIndex}
              highlight={hl}
              onHighlight={setHl}
              onSelectDay={select}
            />
          ) : (
            <Overview trip={trip} />
          )}
        </aside>
      </main>

      <section className="lower">
        <Bookings trip={trip} />
        <Budget trip={trip} />
      </section>

      <footer>
        {trip.updated ? `План обновлён ${new Date(trip.updated + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}` : ''}
        {' · '}Сохранено в этом браузере {new Date(entry.savedAt).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
      </footer>
      {props.importDialog}
    </div>
  );
}
