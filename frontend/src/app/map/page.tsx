'use client';

import dynamic from 'next/dynamic';
import { Navbar } from '@/src/components/Navbar';
import '../../css/Map.css';
import 'leaflet/dist/leaflet.css';

/* Lazy-load the map — Leaflet requires browser APIs (window/document)
   and must never run on the server. ssr: false guarantees this.       */
const MapContainer = dynamic(
  () => import('../../components/Map/MapContainer').then(m => m.MapContainer),
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f0f0f0',
          fontSize: '0.9rem',
          color: '#7f8c8d',
        }}
      >
        Loading map…
      </div>
    ),
  }
);

export default function MapPage() {
  return (
    <div className="map-page">
      <Navbar />
      <MapContainer />
    </div>
  );
}
