'use client';

import { useEffect, useRef, useState } from 'react';
import { SidePanel } from './SidePanel';
import { useCases } from '../../hooks/useCases';

/* ── Types ─────────────────────────────────────────────────── */
export type CaseStatus = 'missing' | 'unidentified' | 'found';

export interface MapCase {
  id: string;
  name: string;
  status: CaseStatus;
  lat: number;
  lng: number;
  barangay: string;
  date: string;
  age: number;
  gender: string;
  location: string;
  description: string;
  imageUrl?: string;
}

/* ── Baguio barangays with approximate coordinates ─────────── */
const BARANGAYS_GEO: Record<string, { lat: number; lng: number }> = {
  'Session Road Area':        { lat: 16.4123, lng: 120.5930 },
  'Legarda-Burnham-Kisad':    { lat: 16.4130, lng: 120.5970 },
  'Camp 7':                   { lat: 16.4280, lng: 120.5850 },
  'Camp 8':                   { lat: 16.4310, lng: 120.5820 },
  'Irisan':                   { lat: 16.3950, lng: 120.5600 },
  'Pacdal':                   { lat: 16.4050, lng: 120.5780 },
  'Mines View Park':          { lat: 16.4350, lng: 120.6100 },
  'Engineers Hill':           { lat: 16.4200, lng: 120.6050 },
  'Trancoville':              { lat: 16.4180, lng: 120.5750 },
  'Lualhati':                 { lat: 16.4090, lng: 120.5870 },
  'Holy Ghost Proper':        { lat: 16.4060, lng: 120.5990 },
  'Holy Ghost Extension':     { lat: 16.4055, lng: 120.5985 },
  'Quirino Hill East':        { lat: 16.4150, lng: 120.6020 },
  'Quirino Hill Lower':       { lat: 16.4140, lng: 120.6010 },
  'Quirino Hill Middle':      { lat: 16.4145, lng: 120.6015 },
  'Quirino Hill West':        { lat: 16.4135, lng: 120.6005 },
  'Bakakeng Central':         { lat: 16.3880, lng: 120.5720 },
  'Bakakeng North':           { lat: 16.3900, lng: 120.5730 },
  'Dagsian Lower':            { lat: 16.4400, lng: 120.6080 },
  'Dagsian Upper':            { lat: 16.4420, lng: 120.6090 },
  'Loakan Proper':            { lat: 16.3750, lng: 120.5650 },
  'Dominican Hill-Mirador':   { lat: 16.4020, lng: 120.5820 },
  'Lower Rock Quarry':        { lat: 16.4230, lng: 120.5900 },
  'Middle Rock Quarry':       { lat: 16.4240, lng: 120.5910 },
  'Upper Rock Quarry':        { lat: 16.4250, lng: 120.5920 },
  'Rock Quarry Lower':        { lat: 16.4230, lng: 120.5900 },
  'Rock Quarry Middle':       { lat: 16.4240, lng: 120.5910 },
  'Rock Quarry Upper':        { lat: 16.4250, lng: 120.5920 },
  'Magsaysay Lower':          { lat: 16.4170, lng: 120.5800 },
  'Magsaysay Upper':          { lat: 16.4190, lng: 120.5810 },
  'Aurora Hill Proper':       { lat: 16.4260, lng: 120.5950 },
  'Aurora Hill North Central':{ lat: 16.4270, lng: 120.5960 },
  'Aurora Hill South Central':{ lat: 16.4255, lng: 120.5945 },
  'Guisad Central':           { lat: 16.4300, lng: 120.5870 },
  'Guisad Sorong':            { lat: 16.4310, lng: 120.5880 },
  'Pinsao Proper':            { lat: 16.3820, lng: 120.5680 },
  'Pinsao Pilot Project':     { lat: 16.3830, lng: 120.5690 },
  'Kias':                     { lat: 16.3700, lng: 120.5550 },
  'Fort del Pilar':           { lat: 16.4080, lng: 120.5760 },
  'South Drive':              { lat: 16.4000, lng: 120.5900 },
  'Burnham Park Area':        { lat: 16.4116, lng: 120.5960 },
  'BGH Compound':             { lat: 16.4100, lng: 120.5940 },
  'Cabinet Hill-Teacher\'s Camp': { lat: 16.4160, lng: 120.5970 },
  'Camp Allen':               { lat: 16.4220, lng: 120.5840 },
  'Campo Filipino':           { lat: 16.4050, lng: 120.5850 },
  'City Camp Central':        { lat: 16.4110, lng: 120.5920 },
  'City Camp Proper':         { lat: 16.4105, lng: 120.5915 },
  'Country Club Village':     { lat: 16.4330, lng: 120.6050 },
  'DPS Area':                 { lat: 16.4070, lng: 120.5770 },
  'Fairview Village':         { lat: 16.4290, lng: 120.5830 },
  'Gabriela Silang':          { lat: 16.4130, lng: 120.5940 },
  'General Luna Road':        { lat: 16.4120, lng: 120.5950 },
  'Gibraltar':                { lat: 16.4360, lng: 120.6110 },
  'Happy Hollow':             { lat: 16.4200, lng: 120.5780 },
  'Honeymoon (Honeymoon Road)': { lat: 16.4380, lng: 120.6070 },
  'Kabayanihan':              { lat: 16.4090, lng: 120.5860 },
  'Kagitingan':               { lat: 16.4095, lng: 120.5865 },
  'Kayang Extension':         { lat: 16.4210, lng: 120.5920 },
  'Kayang-Hilltop':           { lat: 16.4215, lng: 120.5925 },
  'Lopez Jaena':              { lat: 16.4140, lng: 120.5960 },
  'Lower Magsaysay':          { lat: 16.4165, lng: 120.5795 },
  'Lucnab':                   { lat: 16.3860, lng: 120.5710 },
  'Malcolm Square-Perfecto':  { lat: 16.4115, lng: 120.5935 },
  'Manuel A. Roxas':          { lat: 16.4125, lng: 120.5945 },
  'Military Cut-off':         { lat: 16.4230, lng: 120.5870 },
  'MRR-Queen of Peace':       { lat: 16.4175, lng: 120.5805 },
  'Naguilian Road':           { lat: 16.3980, lng: 120.5750 },
  'New Lucban':               { lat: 16.4155, lng: 120.5975 },
  'Outlook Drive':            { lat: 16.4370, lng: 120.6090 },
  'Padre Burgos':             { lat: 16.4108, lng: 120.5918 },
  'Padre Zamora':             { lat: 16.4112, lng: 120.5922 },
  'Quezon Hill Proper':       { lat: 16.4185, lng: 120.5815 },
  'Quezon Hill Upper':        { lat: 16.4195, lng: 120.5825 },
  'Rizal Monument Area':      { lat: 16.4118, lng: 120.5928 },
  'Sagpat':                   { lat: 16.3920, lng: 120.5740 },
  'Saint Joseph Village':     { lat: 16.4320, lng: 120.5860 },
  'Salud Mitra':              { lat: 16.4060, lng: 120.5840 },
  'San Antonio Village':      { lat: 16.4340, lng: 120.5870 },
  'San Luis Village':         { lat: 16.4350, lng: 120.5880 },
  'San Roque Village':        { lat: 16.4360, lng: 120.5890 },
  'San Vicente':              { lat: 16.4370, lng: 120.5900 },
  'Sanitary Camp North':      { lat: 16.4040, lng: 120.5830 },
  'Sanitary Camp South':      { lat: 16.4035, lng: 120.5825 },
  'Santa Escolastica':        { lat: 16.4045, lng: 120.5835 },
  'Santo Rosario':            { lat: 16.4050, lng: 120.5840 },
  'Santo Tomas Proper':       { lat: 16.4055, lng: 120.5845 },
  'Santo Tomas School Area':  { lat: 16.4058, lng: 120.5848 },
  'Scout Barrio':             { lat: 16.4065, lng: 120.5855 },
  'Slaughter House Area':     { lat: 16.4075, lng: 120.5865 },
  'SLU-SVP Housing Village':  { lat: 16.4080, lng: 120.5870 },
  'Teodora Alonzo':           { lat: 16.4085, lng: 120.5875 },
  'Upper Dagsian':            { lat: 16.4430, lng: 120.6100 },
  'Upper Magsaysay':          { lat: 16.4200, lng: 120.5820 },
  'Upper Market Subdivision': { lat: 16.4145, lng: 120.5965 },
  'Upper QM':                 { lat: 16.4260, lng: 120.5930 },
  'Victoria Village':         { lat: 16.4380, lng: 120.5910 },
  'Abanao-Zandueta-Kayong-Chugum-Otek': { lat: 16.4120, lng: 120.5932 },
  'Alfonso Tabora':           { lat: 16.4122, lng: 120.5934 },
  'Ambiong':                  { lat: 16.4390, lng: 120.6060 },
  'Andres Bonifacio':         { lat: 16.4126, lng: 120.5938 },
  'Asin Road':                { lat: 16.3850, lng: 120.5700 },
  'Atok Trail':               { lat: 16.4370, lng: 120.6050 },
  'Bagong Lipunan':           { lat: 16.4128, lng: 120.5942 },
  'Bal-Marcoville':           { lat: 16.4132, lng: 120.5946 },
  'Balsigan':                 { lat: 16.3840, lng: 120.5695 },
  'Banao-Kristong Hari':      { lat: 16.4136, lng: 120.5950 },
  'Bayan Park East':          { lat: 16.4138, lng: 120.5952 },
  'Bayan Park Village':       { lat: 16.4140, lng: 120.5954 },
  'Bayan Park West':          { lat: 16.4142, lng: 120.5956 },
  'Brookside':                { lat: 16.4144, lng: 120.5958 },
  'Brookspoint':              { lat: 16.4146, lng: 120.5962 },
  'Camdas Subdivision':       { lat: 16.4148, lng: 120.5964 },
  'Cresencia Village':        { lat: 16.4150, lng: 120.5966 },
  'Dizon Subdivision':        { lat: 16.4152, lng: 120.5968 },
  'Dontogan':                 { lat: 16.3960, lng: 120.5610 },
  'Ferdinand':                { lat: 16.4154, lng: 120.5972 },
  'Greenwater Village':       { lat: 16.4156, lng: 120.5974 },
  'Happy Homes-Campo Sioco':  { lat: 16.4158, lng: 120.5976 },
  'Harrison Road Central':    { lat: 16.4160, lng: 120.5978 },
  'House of Providence':      { lat: 16.4162, lng: 120.5980 },
  'Imelda R. Marcos':         { lat: 16.4164, lng: 120.5982 },
  'Imelda Village':           { lat: 16.4166, lng: 120.5984 },
  'Lourdes Subdivision Extension': { lat: 16.4168, lng: 120.5986 },
  'Lourdes Subdivision Proper':    { lat: 16.4170, lng: 120.5988 },
  'Magsaysay Private Road':   { lat: 16.4172, lng: 120.5990 },
  'Market Subdivision Upper': { lat: 16.4174, lng: 120.5992 },
  'Middle Quezon Hill':       { lat: 16.4176, lng: 120.5994 },
  'Modern Site East':         { lat: 16.4178, lng: 120.5996 },
  'Modern Site West':         { lat: 16.4180, lng: 120.5998 },
  'Palma-Urbano':             { lat: 16.4182, lng: 120.6000 },
  'Poliwes':                  { lat: 16.3870, lng: 120.5715 },
  'Pucsusan':                 { lat: 16.3875, lng: 120.5718 },
  'Quirino-Magsaysay-Prieto-Dizon': { lat: 16.4184, lng: 120.6002 },
  'Roxas-Trinidad-Montilla':  { lat: 16.4186, lng: 120.6004 },
};

/* Baguio city center fallback */
const BAGUIO_CENTER = { lat: 16.4023, lng: 120.5960 };

/* ── Marker colors ──────────────────────────────────────────── */
const MARKER_COLORS: Record<CaseStatus, string> = {
  missing:      '#e74c3c',
  unidentified: '#f39c12',
  found:        '#27ae60',
};

/* Legend labels matching the card labels */
const LEGEND_LABELS: Record<CaseStatus, string> = {
  missing:      'Missing Person',
  unidentified: 'Unidentified Person',
  found:        'Case Resolved',
};

/* ── SVG pin factory ────────────────────────────────────────── */
function makePinSvg(color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="38" viewBox="0 0 28 38">
    <path d="M14 0C6.27 0 0 6.27 0 14c0 9.33 14 24 14 24s14-14.67 14-24C28 6.27 21.73 0 14 0z" fill="${color}" stroke="white" stroke-width="2"/>
    <circle cx="14" cy="14" r="5" fill="white"/>
  </svg>`;
}

/* ── Resolve coordinates ────────────────────────────────────── */
/* Use exact GPS coords if available, otherwise fall back to
   the barangay's approximate centre, then Baguio city centre. */
function resolveCoords(
  coords: { lat: number; lng: number } | null,
  barangay: string | null
): { lat: number; lng: number } | null {
  if (coords) return coords;
  if (barangay) {
    const approx = BARANGAYS_GEO[barangay];
    if (approx) return approx;
  }
  return null; // no coords and unknown barangay — skip
}

/* ── Component ──────────────────────────────────────────────── */
export function MapContainer() {
  const mapRef        = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<import('leaflet').Map | null>(null);
  const markersRef    = useRef<Map<string, import('leaflet').Marker>>(new Map());

  const { cases: rawCases } = useCases();

  /* Map API shape → MapCase, using barangay fallback for missing coords */
  const cases = rawCases
    .map(c => {
      const coords = resolveCoords(c.coords, c.barangay_name ?? null);
      if (!coords) return null;
      return {
        id:          c.id,
        name:        c.full_name ?? (c.type === 'UNIDENTIFIED' ? 'Unidentified Person' : 'Unknown'),
        status:      (c.status === 'FOUND' || c.status === 'IDENTIFIED'
                       ? 'found'
                       : c.type === 'UNIDENTIFIED'
                         ? 'unidentified'
                         : 'missing') as CaseStatus,
        lat:         coords.lat,
        lng:         coords.lng,
        barangay:    c.barangay_name ?? '',
        date:        c.incident_date ?? c.created_at,
        age:         c.age_approx ?? 0,
        gender:      c.gender === 'FEMALE' ? 'Female' : c.gender === 'MALE' ? 'Male' : 'Unknown',
        location:    c.location_text ?? '',
        description: c.description ?? '',
        imageUrl:    c.photo_url ?? undefined,
      } satisfies MapCase;
    })
    .filter((c): c is NonNullable<typeof c> => c !== null) as MapCase[];

  const [activeCase,    setActiveCase]    = useState<MapCase | null>(null);
  const [visibility,    setVisibility]    = useState<Record<CaseStatus, boolean>>({
    missing: true, unidentified: true, found: true,
  });
  const [searchQuery,   setSearchQuery]   = useState('');
  const [searchResults, setSearchResults] = useState<{ name: string; lat: number; lng: number }[]>([]);

  /* ── Init Leaflet once — StrictMode-safe ── */
  useEffect(() => {
    /* cancelled flag prevents the async callback from running after cleanup */
    let cancelled = false;

    if (!mapRef.current) return;

    /* If a previous Leaflet instance left _leaflet_id on the DOM node, clear it
       before initialising so Leaflet doesn't throw "already initialized". */
    const container = mapRef.current as HTMLDivElement & { _leaflet_id?: number };
    if (container._leaflet_id !== undefined) {
      delete container._leaflet_id;
    }

    /* If we already have a live map instance, don't create another */
    if (leafletMapRef.current) return;

    import('leaflet').then(L => {
      if (cancelled || !mapRef.current) return;

      /* Double-check after the async gap — StrictMode cleanup may have run */
      const el = mapRef.current as HTMLDivElement & { _leaflet_id?: number };
      if (el._leaflet_id !== undefined) {
        delete el._leaflet_id;
      }
      if (leafletMapRef.current) return;

      /* Fix webpack-broken default icon paths */
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: '/leaflet/marker-icon-2x.png',
        iconUrl:       '/leaflet/marker-icon.png',
        shadowUrl:     '/leaflet/marker-shadow.png',
      });

      const map = L.map(mapRef.current, {
        center:      [BAGUIO_CENTER.lat, BAGUIO_CENTER.lng],
        zoom:        14,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      leafletMapRef.current = map;
    });

    return () => {
      cancelled = true;
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
      markersRef.current.clear();
      /* Clear the DOM marker so a future remount can reinitialise cleanly */
      if (mapRef.current) {
        const el = mapRef.current as HTMLDivElement & { _leaflet_id?: number };
        delete el._leaflet_id;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Sync markers when cases or visibility changes ── */
  useEffect(() => {
    if (!leafletMapRef.current) return;

    import('leaflet').then(L => {
      const map = leafletMapRef.current;
      if (!map) return;

      /* Remove all existing markers */
      markersRef.current.forEach(m => m.remove());
      markersRef.current.clear();

      /* Add a marker for each visible case */
      cases.forEach(c => {
        if (!visibility[c.status]) return;

        const icon = L.divIcon({
          html:        makePinSvg(MARKER_COLORS[c.status]),
          className:   '',
          iconSize:    [28, 38],
          iconAnchor:  [14, 38],
          popupAnchor: [0, -38],
        });

        const marker = L.marker([c.lat, c.lng], { icon })
          .addTo(map)
          .on('click', () => setActiveCase(c));

        markersRef.current.set(c.id, marker);
      });
    });
  }, [cases, visibility]);

  /* ── Pan to active case ── */
  useEffect(() => {
    if (!activeCase || !leafletMapRef.current) return;
    leafletMapRef.current.panTo([activeCase.lat, activeCase.lng], { animate: true });
  }, [activeCase]);

  /* ── Barangay search ── */
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    const q = searchQuery.toLowerCase();
    const results = Object.entries(BARANGAYS_GEO)
      .filter(([name]) => name.toLowerCase().includes(q))
      .map(([name, coords]) => ({ name, ...coords }))
      .slice(0, 8);
    setSearchResults(results);
  }, [searchQuery]);

  function flyToBarangay(b: { name: string; lat: number; lng: number }) {
    leafletMapRef.current?.flyTo([b.lat, b.lng], 16, { animate: true, duration: 1 });
    setSearchQuery(b.name);
    setSearchResults([]);
  }

  function handleLocate() {
    navigator.geolocation?.getCurrentPosition(pos => {
      leafletMapRef.current?.flyTo(
        [pos.coords.latitude, pos.coords.longitude], 16, { animate: true }
      );
    });
  }

  function toggleVisibility(status: CaseStatus) {
    setVisibility(prev => ({ ...prev, [status]: !prev[status] }));
  }

  const counts: Record<CaseStatus, number> = {
    missing:      cases.filter(c => c.status === 'missing').length,
    unidentified: cases.filter(c => c.status === 'unidentified').length,
    found:        cases.filter(c => c.status === 'found').length,
  };

  return (
    <div className="map-wrapper">
      {/* Leaflet mount point */}
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} />

      {/* ── Search bar ── */}
      <div className="map-search" role="search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          className="map-search-input"
          type="text"
          placeholder="Search barangay…"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          aria-label="Search barangay"
          aria-autocomplete="list"
          aria-expanded={searchResults.length > 0}
        />
        {searchResults.length > 0 && (
          <div className="map-search-results" role="listbox">
            {searchResults.map(b => (
              <div
                key={b.name}
                className="map-search-result-item"
                role="option"
                aria-selected={false}
                onClick={() => flyToBarangay(b)}
                onKeyDown={e => e.key === 'Enter' && flyToBarangay(b)}
                tabIndex={0}
              >
                {b.name}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── My Location button ── */}
      <button
        className="map-locate-btn"
        onClick={handleLocate}
        aria-label="Center map on my location"
        title="My Location"
        style={{ top: `calc(clamp(0.75rem, 2vh, 1.25rem) + 44px + 0.75rem)` }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="12" r="3"/>
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
          <circle cx="12" cy="12" r="8" strokeDasharray="2 2"/>
        </svg>
      </button>

      {/* ── Legend ── */}
      <div className="map-legend" role="group" aria-label="Map legend">
        <div className="map-legend-title">Legend</div>
        <div className="map-legend-items">
          {(['missing', 'unidentified', 'found'] as CaseStatus[]).map(s => (
            <div
              key={s}
              className={`map-legend-item${visibility[s] ? '' : ' disabled'}`}
              onClick={() => toggleVisibility(s)}
              role="checkbox"
              aria-checked={visibility[s]}
              tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && toggleVisibility(s)}
            >
              <span className={`map-legend-dot ${s}`} />
              <span className="map-legend-label">{LEGEND_LABELS[s]}</span>
              <span className="map-legend-count">{counts[s]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Empty state overlay ── */}
      {cases.length === 0 && (
        <div className="map-empty-overlay" role="status" aria-live="polite">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
            <circle cx="12" cy="10" r="3"/>
            <line x1="12" y1="2" x2="12" y2="4"/>
          </svg>
          <p>No cases to display on the map yet.</p>
        </div>
      )}

      {/* ── Side panel ── */}
      <SidePanel
        activeCase={activeCase}
        allCases={cases}
        onClose={() => setActiveCase(null)}
        onSelectCase={setActiveCase}
      />
    </div>
  );
}
