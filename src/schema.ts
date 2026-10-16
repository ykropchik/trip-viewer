import { z } from 'zod';

/**
 * Trip format, version 1.
 * The site is only a viewer: everything it shows comes from one JSON document of this shape.
 */

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Дата в формате YYYY-MM-DD');
const id = z.string().regex(/^[a-z0-9][a-z0-9-_]*$/, 'Только латиница в нижнем регистре, цифры, «-» и «_»');
const lat = z.number().min(-90).max(90);
const lon = z.number().min(-180).max(180);
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Цвет в формате #RRGGBB');

export const CategorySchema = z.object({
  label: z.string().min(1).describe('Название категории для легенды'),
  color: hex.describe('Цвет маркеров категории'),
});

export const PlaceSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1).describe('Ключ из categories'),
  lat,
  lon,
  query: z.string().optional().describe('Строка поиска для Google Maps; по умолчанию name'),
  note: z.string().optional(),
  url: z.string().url().optional().describe('Сайт места'),
});

export const StaySchema = z.object({
  id,
  city: z.string().min(1).describe('Город или база, например «Токио»'),
  area: z.string().min(1).describe('Район или конкретный отель'),
  checkIn: isoDate,
  checkOut: isoDate,
  lat,
  lon,
  radiusKm: z.number().positive().max(30).default(1.5).describe('Радиус района, где искать жильё'),
  why: z.string().optional().describe('Почему этот район'),
  alt: z.string().optional().describe('Альтернатива или оговорка'),
  hotel: z.string().optional().describe('Название забронированного отеля'),
});

export const StopSchema = z.object({
  place: z.string().optional().describe('Ключ из places; без него пункт показывается без точки на карте'),
  time: z.string().optional().describe('Время или часть дня: «09:25», «утро», «вечер»'),
  text: z.string().min(1),
});

export const MoveSchema = z.object({
  how: z.string().min(1).describe('Как едем: «Синкансэн, Токио → Нагоя»'),
  duration: z.string().optional().describe('Сколько в пути: «~1 ч 40 мин»'),
});

export const DaySchema = z.object({
  date: isoDate,
  title: z.string().min(1),
  stay: z.string().nullable().optional().describe('id из stays — где ночуем; null в день вылета'),
  stops: z.array(StopSchema).default([]),
  moves: z.array(MoveSchema).default([]),
  tip: z.string().optional(),
});

export const LineSchema = z.object({
  name: z.string().min(1),
  kind: z.enum(['highspeed', 'rail']).default('rail'),
  path: z.array(z.tuple([lon, lat])).min(2).describe('Точки линии: [долгота, широта]'),
});

export const BookingSchema = z.object({
  id,
  what: z.string().min(1),
  when: z.string().min(1).describe('Когда бронировать, текстом'),
  deadline: isoDate.optional().describe('Крайняя дата, для сортировки и подсветки'),
  url: z.string().url().optional(),
  done: z.boolean().default(false),
});

export const BudgetItemSchema = z.object({
  what: z.string().min(1),
  how: z.string().optional().describe('Как посчитано'),
  min: z.number().nonnegative(),
  max: z.number().nonnegative(),
});

export const TripSchema = z
  .object({
    $schema: z.string().optional(),
    version: z.literal(1),
    id,
    title: z.string().min(1),
    subtitle: z.string().optional(),
    start: isoDate,
    end: isoDate,
    travelers: z.number().int().positive().default(1),
    updated: isoDate.optional().describe('Когда план последний раз менялся'),
    categories: z.record(z.string(), CategorySchema),
    places: z.record(z.string(), PlaceSchema),
    stays: z.array(StaySchema).default([]),
    days: z.array(DaySchema).min(1),
    lines: z.array(LineSchema).default([]),
    bookings: z.array(BookingSchema).default([]),
    budget: z
      .object({
        currency: z.string().default('USD'),
        note: z.string().optional(),
        items: z.array(BudgetItemSchema).default([]),
      })
      .optional(),
  })
  .superRefine((t, ctx) => {
    const err = (path: (string | number)[], message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });
    if (t.end < t.start) err(['end'], 'Конец поездки раньше начала');
    for (const [key, p] of Object.entries(t.places)) {
      if (!t.categories[p.category]) err(['places', key, 'category'], `Нет категории «${p.category}» в categories`);
    }
    const stayIds = new Set(t.stays.map(s => s.id));
    t.stays.forEach((s, i) => {
      if (s.checkOut <= s.checkIn) err(['stays', i, 'checkOut'], 'Выезд должен быть позже заезда');
    });
    const seenDates = new Set<string>();
    t.days.forEach((d, i) => {
      if (seenDates.has(d.date)) err(['days', i, 'date'], `Дата ${d.date} повторяется`);
      seenDates.add(d.date);
      if (d.date < t.start || d.date > t.end) err(['days', i, 'date'], `Дата ${d.date} вне поездки`);
      if (d.stay && !stayIds.has(d.stay)) err(['days', i, 'stay'], `Нет ночёвки «${d.stay}» в stays`);
      d.stops.forEach((s, j) => {
        if (s.place && !t.places[s.place]) err(['days', i, 'stops', j, 'place'], `Нет места «${s.place}» в places`);
      });
    });
    const bookingIds = new Set<string>();
    t.bookings.forEach((b, i) => {
      if (bookingIds.has(b.id)) err(['bookings', i, 'id'], `id «${b.id}» повторяется`);
      bookingIds.add(b.id);
    });
  });

export type Trip = z.infer<typeof TripSchema>;
export type Place = z.infer<typeof PlaceSchema>;
export type Stay = z.infer<typeof StaySchema>;
export type Day = z.infer<typeof DaySchema>;

export type ValidationResult =
  | { ok: true; trip: Trip }
  | { ok: false; errors: { path: string; message: string }[] };

export function validateTrip(input: unknown): ValidationResult {
  let data = input;
  if (typeof input === 'string') {
    try {
      data = JSON.parse(input);
    } catch (e) {
      return { ok: false, errors: [{ path: '', message: `Это не JSON: ${(e as Error).message}` }] };
    }
  }
  const r = TripSchema.safeParse(data);
  if (r.success) return { ok: true, trip: r.data };
  return {
    ok: false,
    errors: r.error.issues.map(i => ({ path: i.path.join('.'), message: i.message })),
  };
}
