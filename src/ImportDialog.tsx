import { useEffect, useRef, useState } from 'react';
import { validateTrip, type Trip } from './schema';
import { store } from './storage';
import { go } from './route';

export function ImportDialog({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [text, setText] = useState('');
  const [errors, setErrors] = useState<{ path: string; message: string }[]>([]);
  const [pending, setPending] = useState<Trip | null>(null);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  const commit = (trip: Trip) => {
    try {
      store.save(trip);
    } catch (e) {
      setSaveError(`Не удалось сохранить в браузере: ${(e as Error).message}`);
      return;
    }
    go({ view: 'trip', id: trip.id });
    onClose();
  };

  const check = (raw: string) => {
    setPending(null);
    setSaveError('');
    const r = validateTrip(raw);
    if (!r.ok) {
      setErrors(r.errors);
      return;
    }
    setErrors([]);
    if (store.has(r.trip.id)) setPending(r.trip);
    else commit(r.trip);
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    const raw = await f.text();
    setText(raw);
    check(raw);
  };

  return (
    <dialog ref={ref} className="dialog" onClose={onClose} onCancel={onClose}>
      <form method="dialog" onSubmit={e => { e.preventDefault(); check(text); }}>
        <h2>Импорт поездки</h2>
        <p className="muted small">Вставьте JSON или выберите файл. Поездка с тем же <code>id</code> заменит сохранённую.</p>
        <label className="file">
          <input id="import-file" type="file" accept="application/json,.json" onChange={e => onFile(e.target.files?.[0])} />
        </label>
        <textarea
          id="import-text"
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder='{ "version": 1, "id": "my-trip", ... }'
          spellCheck={false}
          rows={12}
        />
        {errors.length > 0 && (
          <div className="errors" role="alert">
            <b>Файл не подходит под формат ({errors.length}):</b>
            <ul>
              {errors.slice(0, 12).map((e, i) => (
                <li key={i}><code>{e.path || 'корень'}</code> — {e.message}</li>
              ))}
            </ul>
            {errors.length > 12 && <div>…и ещё {errors.length - 12}</div>}
          </div>
        )}
        {saveError && <div className="errors" role="alert">{saveError}</div>}
        {pending && (
          <div className="replace">
            Поездка <b>«{store.get(pending.id)?.trip.title}»</b> уже есть в этом браузере.
            <div className="row">
              <button className="btn primary" type="button" onClick={() => commit(pending)}>Заменить</button>
              <button className="btn" type="button" onClick={() => setPending(null)}>Отмена</button>
            </div>
          </div>
        )}
        <div className="row end">
          <button className="btn" type="button" onClick={onClose}>Закрыть</button>
          <button className="btn primary" type="submit" disabled={!text.trim()}>Проверить и сохранить</button>
        </div>
      </form>
    </dialog>
  );
}
