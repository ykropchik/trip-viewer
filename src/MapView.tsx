import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { GeoJSONSource, Map as MLMap, Marker } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { stopPlaces, type Day, type Place, type Trip } from './schema';
import { daysWithPlace, gmapsUrl, chipLabel, nightsBetween, nightsWord } from './util';

// The bundled build can't find maplibre's worker next to itself, so point it at Vite's worker chunk.
maplibregl.setWorkerUrl(workerUrl);

const STYLE = 'https://tiles.openfreemap.org/styles/positron';
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Lets other components (the stays list) ask the map to fly to a stay. */
export const focusStay = (id: string) => window.dispatchEvent(new CustomEvent('trip:focus-stay', { detail: id }));

type Props = {
  trip: Trip;
  day: Day | null;
  highlight: number | null;
  onHighlight: (i: number | null) => void;
  onSelectDay: (date: string) => void;
};

type FC = GeoJSON.FeatureCollection;
const fc = (features: GeoJSON.Feature[]): FC => ({ type: 'FeatureCollection', features });

function circle(lon: number, lat: number, km: number, steps = 72): GeoJSON.Position[] {
  const pts: GeoJSON.Position[] = [];
  const dLat = km / 110.574;
  const dLon = km / (111.32 * Math.cos((lat * Math.PI) / 180));
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2 * Math.PI;
    pts.push([lon + dLon * Math.cos(a), lat + dLat * Math.sin(a)]);
  }
  return pts;
}

function localizeLabels(map: MLMap) {
  const field = ['coalesce', ['get', 'name:ru'], ['get', 'name:en'], ['get', 'name_en'], ['get', 'name']];
  for (const layer of map.getStyle().layers ?? []) {
    if (layer.type !== 'symbol') continue;
    if (!map.getLayoutProperty(layer.id, 'text-field')) continue;
    try {
      map.setLayoutProperty(layer.id, 'text-field', field as maplibregl.ExpressionSpecification);
    } catch {
      /* leave the layer as styled */
    }
  }
}

export function MapView({ trip, day, highlight, onHighlight, onSelectDay }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const markers = useRef<Marker[]>([]);
  const numbered = useRef<HTMLElement[]>([]);
  const popup = useRef<maplibregl.Popup | null>(null);
  const [ready, setReady] = useState(false);
  const cb = useRef({ onHighlight, onSelectDay });
  cb.current = { onHighlight, onSelectDay };

  // create the map once
  useEffect(() => {
    const map = new maplibregl.Map({
      container: box.current!,
      style: STYLE,
      center: [137.5, 35.3],
      zoom: 6,
      attributionControl: { compact: true },
      cooperativeGestures: false,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    // If the tile service is unreachable, fall back to a plain background so the trip itself still shows.
    let styleOk = false;
    map.once('styledata', () => (styleOk = true));
    map.on('error', () => {
      if (styleOk || map.isStyleLoaded()) return;
      styleOk = true;
      map.setStyle({ version: 8, sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#dfe6ec' } }] });
    });
    map.on('load', () => {
      localizeLabels(map);
      const before = map.getStyle().layers?.find((l: { type: string; id: string }) => l.type === 'symbol')?.id;
      map.addSource('stays', { type: 'geojson', data: fc([]) });
      map.addSource('lines', { type: 'geojson', data: fc([]) });
      map.addSource('trip', { type: 'geojson', data: fc([]) });
      map.addSource('route', { type: 'geojson', data: fc([]) });
      map.addLayer({ id: 'stays-fill', type: 'fill', source: 'stays', paint: { 'fill-color': '#1c5cbf', 'fill-opacity': ['case', ['get', 'active'], 0.16, 0.08] } }, before);
      map.addLayer({ id: 'stays-line', type: 'line', source: 'stays', paint: { 'line-color': '#1c5cbf', 'line-width': ['case', ['get', 'active'], 2, 1.2], 'line-dasharray': [3, 2] } }, before);
      map.addLayer({ id: 'lines-rail', type: 'line', source: 'lines', filter: ['==', ['get', 'kind'], 'rail'], paint: { 'line-color': '#6b7785', 'line-width': 1.6, 'line-opacity': 0.6, 'line-dasharray': [3, 2] } }, before);
      map.addLayer({ id: 'lines-hs', type: 'line', source: 'lines', filter: ['==', ['get', 'kind'], 'highspeed'], layout: { 'line-cap': 'round' }, paint: { 'line-color': '#1c5cbf', 'line-width': 2.6, 'line-opacity': 0.55 } }, before);
      map.addLayer({ id: 'trip', type: 'line', source: 'trip', layout: { 'line-cap': 'round' }, paint: { 'line-color': '#d7263d', 'line-width': 2.2, 'line-dasharray': [0.5, 2.5], 'line-opacity': 0.9 } });
      map.addLayer({ id: 'route', type: 'line', source: 'route', layout: { 'line-cap': 'round' }, paint: { 'line-color': '#16202a', 'line-width': 2, 'line-dasharray': [2, 2], 'line-opacity': 0.6 } });
      map.on('click', 'stays-fill', (e: maplibregl.MapLayerMouseEvent) => {
        const f = e.features?.[0];
        if (f) window.dispatchEvent(new CustomEvent('trip:focus-stay', { detail: f.properties?.id }));
      });
      map.on('mouseenter', 'stays-fill', () => (map.getCanvas().style.cursor = 'pointer'));
      map.on('mouseleave', 'stays-fill', () => (map.getCanvas().style.cursor = ''));
      setReady(true);
    });
    mapRef.current = map;
    const ro = new ResizeObserver(() => map.resize());
    ro.observe(box.current!);
    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // data, markers and camera for the current trip/day
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const P = trip.places;
    const color = (p: Place) => trip.categories[p.category]?.color ?? '#6b7785';

    (map.getSource('stays') as GeoJSONSource).setData(
      fc(trip.stays.map(s => ({
        type: 'Feature',
        properties: { id: s.id, active: day?.stay === s.id },
        geometry: { type: 'Polygon', coordinates: [circle(s.lon, s.lat, s.radiusKm)] },
      }))),
    );
    (map.getSource('lines') as GeoJSONSource).setData(
      fc(trip.lines.map(l => ({ type: 'Feature', properties: { kind: l.kind, name: l.name }, geometry: { type: 'LineString', coordinates: l.path } }))),
    );

    // overview path: first stop → stays in order → last stop
    const firstStop = trip.days[0] ? stopPlaces(trip.days[0])[0] : undefined;
    const lastDay = trip.days[trip.days.length - 1];
    const lastStop = lastDay ? stopPlaces(lastDay).at(-1) : undefined;
    const tripPath: GeoJSON.Position[] = [];
    if (firstStop) tripPath.push([P[firstStop].lon, P[firstStop].lat]);
    trip.stays.forEach(s => tripPath.push([s.lon, s.lat]));
    if (lastStop) tripPath.push([P[lastStop].lon, P[lastStop].lat]);
    (map.getSource('trip') as GeoJSONSource).setData(
      fc(!day && tripPath.length > 1 ? [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: tripPath } }] : []),
    );

    const stopIds = day ? stopPlaces(day) : [];
    (map.getSource('route') as GeoJSONSource).setData(
      fc(stopIds.length > 1 ? [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: stopIds.map(id => [P[id].lon, P[id].lat]) } }] : []),
    );

    markers.current.forEach(m => m.remove());
    markers.current = [];
    numbered.current = [];
    popup.current?.remove();

    const openPopup = (id: string) => {
      const p = P[id];
      const el = document.createElement('div');
      el.className = 'pop';
      const h = document.createElement('div');
      h.className = 'pop-h';
      h.textContent = p.name;
      el.appendChild(h);
      const ds = daysWithPlace(trip, id);
      if (ds.length) {
        const row = document.createElement('div');
        row.className = 'pop-days';
        ds.forEach(d => {
          const b = document.createElement('button');
          b.type = 'button';
          b.textContent = chipLabel(d.date);
          b.onclick = () => cb.current.onSelectDay(d.date);
          row.appendChild(b);
        });
        el.appendChild(row);
      }
      if (p.note) {
        const n = document.createElement('div');
        n.className = 'pop-note';
        n.textContent = p.note;
        el.appendChild(n);
      }
      const a = document.createElement('a');
      a.href = gmapsUrl(p);
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = 'Открыть в Google Maps ↗';
      el.appendChild(a);
      popup.current = new maplibregl.Popup({ offset: 16, maxWidth: '260px' }).setLngLat([p.lon, p.lat]).setDOMContent(el).addTo(map);
    };

    const add = (el: HTMLElement, lon: number, lat: number, anchor: maplibregl.PositionAnchor = 'center', offset: [number, number] = [0, 0]) => {
      markers.current.push(new maplibregl.Marker({ element: el, anchor, offset }).setLngLat([lon, lat]).addTo(map));
    };

    for (const [id, p] of Object.entries(P)) {
      if (stopIds.includes(id)) continue;
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'mk-dot' + (day ? ' faint' : '');
      el.style.setProperty('--c', color(p));
      // hover effects go on this inner dot: maplibre positions the root via transform
      el.appendChild(Object.assign(document.createElement('span'), { className: 'd' }));
      el.title = p.name;
      el.setAttribute('aria-label', p.name);
      el.addEventListener('click', e => { e.stopPropagation(); openPopup(id); });
      add(el, p.lon, p.lat);
    }

    if (!day) {
      // stays closer than 3 km share one tag ("Токио 5 · Синдзюку 1"), otherwise tags pile up
      const groups: { lon: number; lat: number; items: typeof trip.stays }[] = [];
      trip.stays.forEach(s => {
        const g = groups.find(g => Math.hypot((g.lon - s.lon) * 91, (g.lat - s.lat) * 111) < 3);
        if (g) g.items.push(s);
        else groups.push({ lon: s.lon, lat: s.lat, items: [s] });
      });
      groups.forEach(g => {
        const el = document.createElement('div');
        el.className = 'stay-tag';
        const b = document.createElement('b');
        const small = document.createElement('span');
        if (g.items.length === 1) {
          b.textContent = g.items[0].city;
          small.textContent = nightsWord(nightsBetween(g.items[0].checkIn, g.items[0].checkOut));
        } else {
          b.textContent = g.items[0].city;
          small.textContent = g.items.map(s => `${s.city === g.items[0].city ? '' : s.city + ' '}${nightsBetween(s.checkIn, s.checkOut)}`).join(' + ') + ' ноч.';
        }
        el.append(b, small);
        add(el, g.lon, g.lat, 'bottom', [0, -8]);
      });
    }

    stopIds.forEach((id, i) => {
      const p = P[id];
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'mk-num';
      el.style.setProperty('--c', color(p));
      el.setAttribute('aria-label', `${i + 1}. ${p.name}`);
      const n = document.createElement('span');
      n.className = 'n';
      n.textContent = String(i + 1);
      const l = document.createElement('span');
      l.className = 'l';
      l.textContent = p.name;
      el.append(n, l);
      el.addEventListener('click', e => { e.stopPropagation(); cb.current.onHighlight(i); openPopup(id); });
      el.addEventListener('mouseenter', () => cb.current.onHighlight(i));
      el.addEventListener('mouseleave', () => cb.current.onHighlight(null));
      add(el, p.lon, p.lat);
      numbered.current.push(el);
    });

    // camera
    const pts = day ? stopIds.map(id => [P[id].lon, P[id].lat] as [number, number]) : Object.values(P).map(p => [p.lon, p.lat] as [number, number]);
    if (pts.length === 1) {
      map.flyTo({ center: pts[0], zoom: 13, duration: reduced() ? 0 : 900 });
    } else if (pts.length > 1) {
      const b = new maplibregl.LngLatBounds(pts[0], pts[0]);
      pts.forEach(p => b.extend(p));
      map.fitBounds(b, { padding: { top: 70, bottom: 50, left: 60, right: 140 }, maxZoom: 14, duration: reduced() ? 0 : 900 });
    }
  }, [ready, trip, day]);

  useEffect(() => {
    numbered.current.forEach((el, i) => el.classList.toggle('hl', i === highlight));
  }, [highlight, ready, trip, day]);

  // fly to a stay on request
  useEffect(() => {
    const on = (e: Event) => {
      const map = mapRef.current;
      const s = trip.stays.find(x => x.id === (e as CustomEvent).detail);
      if (!map || !s) return;
      const ring = circle(s.lon, s.lat, s.radiusKm, 8) as [number, number][];
      const b = new maplibregl.LngLatBounds(ring[0], ring[0]);
      ring.forEach(p => b.extend(p));
      map.fitBounds(b, { padding: 60, maxZoom: 16, duration: reduced() ? 0 : 900 });
    };
    window.addEventListener('trip:focus-stay', on);
    return () => window.removeEventListener('trip:focus-stay', on);
  }, [trip]);

  return (
    <>
      <div className="map-box" ref={box} />
      <div className="legend">
        {Object.entries(trip.categories)
          .filter(([k]) => Object.values(trip.places).some(p => p.category === k))
          .map(([k, c]) => (
            <span key={k} className="lg"><span className="dot" style={{ background: c.color }} />{c.label}</span>
          ))}
        {trip.lines.some(l => l.kind === 'highspeed') && <span className="lg muted"><span className="lg-line" />Скоростная ж/д</span>}
        {trip.lines.some(l => l.kind === 'rail') && <span className="lg muted"><span className="lg-line rail" />Другие поезда</span>}
        {trip.stays.length > 0 && <span className="lg muted"><span className="lg-zone" />Где искать жильё</span>}
      </div>
    </>
  );
}
