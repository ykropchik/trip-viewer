# Trip Viewer

Просмотрщик поездок: карта, план по дням, районы для жилья, брони и бюджет. Сам сайт ничего не знает о конкретной поездке — всё берётся из JSON-файла с заранее описанной структурой.

## Как это устроено

- **Поездка — один JSON-файл.** Формат описан в [`src/schema.ts`](src/schema.ts) (zod) и экспортирован в [`public/trip.schema.json`](public/trip.schema.json).
- **Хранение — localStorage браузера.** Поездки видны только в том браузере, куда их загрузили. Несколько поездок хранятся рядом, их можно сравнить.
- **Карта** — MapLibre GL с бесплатными тайлами [OpenFreeMap](https://openfreemap.org) (без ключа). Если тайлы недоступны, точки и маршруты всё равно рисуются на простом фоне.
- **Адреса страниц:** `#/t/<id>` — поездка, `#/t/<id>/<YYYY-MM-DD>` — день, `#/compare/<a>/<b>` — сравнение.

## Формат поездки (кратко)

| Поле | Что это |
| --- | --- |
| `version` | Всегда `1` |
| `id` | Латиница, цифры, `-`, `_`. Поездка с тем же `id` заменяется при импорте |
| `start`, `end` | Даты `YYYY-MM-DD` |
| `categories` | `{ key: { label, color } }` — легенда и цвета маркеров |
| `places` | `{ key: { name, category, lat, lon, query?, note?, url? } }` — все точки на карте |
| `stays` | Ночёвки: город, район, `checkIn`/`checkOut`, центр и `radiusKm` района, `why`, `alt`, `hotel` |
| `days` | По дню на дату: `title`, `stay` (id ночёвки), `stops` (`place?`, `time?`, `text`), `moves`, `tip` |
| `lines` | Линии поездов: `kind: "highspeed" \| "rail"`, `path: [[lon, lat], …]` |
| `bookings` | Что забронировать: `what`, `when`, `deadline?`, `url?`, `done` |
| `budget` | `currency`, `note`, `items: [{ what, how?, min, max }]` |

Сайт проверяет связи при импорте: каждая `stop.place` должна быть в `places`, `day.stay` — в `stays`, `place.category` — в `categories`.

```bash
npm run validate -- path/to/trip.json   # проверить файл из консоли
```

## Обновление поездки

1. **Вручную:** кнопка «Импорт» → вставить JSON или выбрать файл. «Экспорт» скачивает текущую версию.
2. **Из консоли браузера или агентом** (Claude через браузер):

```js
tripPlanner.list()                     // [{ id, title, start, end, savedAt }]
tripPlanner.get('my-trip')          // полный JSON
tripPlanner.validate(json)             // { ok } | { ok: false, errors: [{ path, message }] }
tripPlanner.save(json, { open: true }) // создать или заменить по id
tripPlanner.remove('my-trip')
tripPlanner.open('my-trip', '2027-05-09')
```

3. **WebMCP:** если браузер поддерживает `navigator.modelContext`, страница регистрирует инструменты `list_trips`, `get_trip`, `save_trip`, `get_trip_schema`.

Отметки «забронировано» хранятся внутри JSON поездки (`bookings[].done`), поэтому попадают в экспорт.

## Разработка

```bash
npm install
npm run dev       # локально
npm run build     # схема + typecheck + сборка в dist/
```

Деплой на Vercel: импортировать репозиторий, пресет Vite определится сам (`npm run build`, папка `dist`).
