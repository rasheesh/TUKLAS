'use client';

import { useState } from 'react';

export interface IncidentData {
  barangay: string;
  date: string;
  time: string;
  location: string;
}

interface StepIncidentProps {
  type: 'missing' | 'unidentified';
  data: IncidentData;
  onChange: (data: IncidentData) => void;
  errors: Partial<Record<keyof IncidentData, string>>;
}

const BARANGAYS: string[] = [
  'Abanao-Zandueta-Kayong-Chugum-Otek',
  'Alfonso Tabora',
  'Ambiong',
  'Andres Bonifacio',
  'Asin Road',
  'Atok Trail',
  'Aurora Hill North Central',
  'Aurora Hill Proper',
  'Aurora Hill South Central',
  'Bagong Lipunan',
  'Bakakeng Central',
  'Bakakeng North',
  'Bal-Marcoville',
  'Balsigan',
  'Banao-Kristong Hari',
  'Bayan Park East',
  'Bayan Park Village',
  'Bayan Park West',
  'BGH Compound',
  'Brookside',
  'Brookspoint',
  "Cabinet Hill-Teacher's Camp",
  'Camdas Subdivision',
  'Camp 7',
  'Camp 8',
  'Camp Allen',
  'Campo Filipino',
  'City Camp Central',
  'City Camp Proper',
  'Country Club Village',
  'Cresencia Village',
  'Dagsian Lower',
  'Dagsian Upper',
  'Dizon Subdivision',
  'Dominican Hill-Mirador',
  'Dontogan',
  'DPS Area',
  'Engineers Hill',
  'Fairview Village',
  'Ferdinand',
  'Fort del Pilar',
  'Gabriela Silang',
  'General Luna Road',
  'Gibraltar',
  'Greenwater Village',
  'Guisad Central',
  'Guisad Sorong',
  'Happy Hollow',
  'Happy Homes-Campo Sioco',
  'Harrison Road Central',
  'Holy Ghost Extension',
  'Holy Ghost Proper',
  'Honeymoon (Honeymoon Road)',
  'House of Providence',
  'Imelda R. Marcos',
  'Imelda Village',
  'Irisan',
  'Kabayanihan',
  'Kagitingan',
  'Kayang Extension',
  'Kayang-Hilltop',
  'Kias',
  'Legarda-Burnham-Kisad',
  'Loakan Proper',
  'Lopez Jaena',
  'Lourdes Subdivision Extension',
  'Lourdes Subdivision Proper',
  'Lower Dagsian',
  'Lower Magsaysay',
  'Lower Rock Quarry',
  'Lualhati',
  'Lucnab',
  'Magsaysay Lower',
  'Magsaysay Private Road',
  'Magsaysay Upper',
  'Malcolm Square-Perfecto',
  'Manuel A. Roxas',
  'Market Subdivision Upper',
  'Middle Quezon Hill',
  'Middle Rock Quarry',
  'Military Cut-off',
  'Mines View Park',
  'Modern Site East',
  'Modern Site West',
  'MRR-Queen of Peace',
  'Naguilian Road',
  'New Lucban',
  'Outlook Drive',
  'Pacdal',
  'Padre Burgos',
  'Padre Zamora',
  'Palma-Urbano',
  'Pinsao Pilot Project',
  'Pinsao Proper',
  'Poliwes',
  'Pucsusan',
  'Quezon Hill Proper',
  'Quezon Hill Upper',
  'Quirino Hill East',
  'Quirino Hill Lower',
  'Quirino Hill Middle',
  'Quirino Hill West',
  'Quirino-Magsaysay-Prieto-Dizon',
  'Rizal Monument Area',
  'Rock Quarry Lower',
  'Rock Quarry Middle',
  'Rock Quarry Upper',
  'Roxas-Trinidad-Montilla',
  'Sagpat',
  'Saint Joseph Village',
  'Salud Mitra',
  'San Antonio Village',
  'San Luis Village',
  'San Roque Village',
  'San Vicente',
  'Sanitary Camp North',
  'Sanitary Camp South',
  'Santa Escolastica',
  'Santo Rosario',
  'Santo Tomas Proper',
  'Santo Tomas School Area',
  'Scout Barrio',
  'Session Road Area',
  'Slaughter House Area',
  'SLU-SVP Housing Village',
  'South Drive',
  'Teodora Alonzo',
  'Trancoville',
  'Upper Dagsian',
  'Upper Magsaysay',
  'Upper Market Subdivision',
  'Upper QM',
  'Upper Rock Quarry',
  'Victoria Village',
];

export function StepIncident({ type, data, onChange, errors }: StepIncidentProps) {
  const [barangaySearch, setBarangaySearch] = useState('');

  const set = (field: keyof IncidentData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      onChange({ ...data, [field]: e.target.value });

  const filteredBarangays = barangaySearch.trim()
    ? BARANGAYS.filter((b) =>
        b.toLowerCase().includes(barangaySearch.toLowerCase())
      )
    : BARANGAYS;

  const locationLabel = type === 'missing' ? 'Last Seen' : 'Found';
  const dateLabel = type === 'missing' ? 'Date Last Seen' : 'Date Found';
  const timeLabel = type === 'missing' ? 'Time Last Seen' : 'Time Found';

  return (
    <div>
      <h2 className="form-card-title">Incident Details</h2>
      <p className="form-card-subtitle">
        {type === 'missing'
          ? 'Provide details about when and where the person was last seen.'
          : 'Provide details about where and when the person was found.'}
      </p>

      {/* Barangay */}
      <div className="form-group">
        <label className="form-label" htmlFor="incident-barangay-search">
          {locationLabel} Barangay <span className="required-star">*</span>
        </label>
        <div className="barangay-search-wrapper">
          <input
            id="incident-barangay-search"
            type="text"
            className="form-input barangay-search-input"
            value={barangaySearch}
            onChange={(e) => setBarangaySearch(e.target.value)}
            placeholder="Type to filter barangays..."
            autoComplete="off"
          />
          <select
            id="incident-barangay"
            className={`barangay-select-list${errors.barangay ? ' error' : ''}`}
            size={5}
            value={data.barangay}
            onChange={set('barangay')}
            aria-label="Select barangay"
          >
            <option value="">— Select a barangay —</option>
            {filteredBarangays.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>
        {data.barangay && (
          <span className="form-hint">Selected: {data.barangay}</span>
        )}
        {errors.barangay && <span className="form-error">{errors.barangay}</span>}
      </div>

      {/* Date + Time row */}
      <div className="form-row">
        <div className="form-group">
          <label className="form-label" htmlFor="incident-date">
            {dateLabel} <span className="required-star">*</span>
          </label>
          <input
            id="incident-date"
            type="date"
            className={`form-input${errors.date ? ' error' : ''}`}
            value={data.date}
            onChange={set('date')}
            max={new Date().toISOString().split('T')[0]}
          />
          {errors.date && <span className="form-error">{errors.date}</span>}
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="incident-time">
            {timeLabel}
          </label>
          <input
            id="incident-time"
            type="time"
            className="form-input"
            value={data.time}
            onChange={set('time')}
          />
        </div>
      </div>

      {/* Specific location */}
      <div className="form-group">
        <label className="form-label" htmlFor="incident-location">
          Specific Location / Landmark <span className="required-star">*</span>
        </label>
        <input
          id="incident-location"
          type="text"
          className={`form-input${errors.location ? ' error' : ''}`}
          value={data.location}
          onChange={set('location')}
          placeholder={
            type === 'missing'
              ? 'e.g. Near SM City Baguio, Session Road'
              : 'e.g. Found near Burnham Park fountain'
          }
          autoComplete="off"
        />
        {errors.location && <span className="form-error">{errors.location}</span>}
      </div>
    </div>
  );
}
