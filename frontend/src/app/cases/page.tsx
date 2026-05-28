'use client';

import { useState, useMemo } from 'react';
import { Navbar } from '@/src/components/Navbar';
import { CaseCard, type CaseData, type CaseStatus } from '@/src/components/CaseCard';
import '../../css/browse.css';

/* ── 128 Baguio City barangays ─────────────────────────────── */
const BARANGAYS = [
  'Abanao-Zandueta-Kayong-Chugum-Otek', 'Alfonso Tabora', 'Ambiong', 'Andres Bonifacio',
  'Asin Road', 'Atok Trail', 'Aurora Hill Proper', 'Aurora Hill North Central',
  'Aurora Hill South Central', 'Bagong Lipunan', 'Bakakeng Central', 'Bakakeng North',
  'Bal-Marcoville', 'Balsigan', 'Banao-Kristong Hari', 'Bayan Park East',
  'Bayan Park Village', 'Bayan Park West', 'BGH Compound', 'Brookside',
  'Brookspoint', 'Cabinet Hill-Teacher\'s Camp', 'Camdas Subdivision', 'Camp 7',
  'Camp 8', 'Camp Allen', 'Campo Filipino', 'City Camp Central', 'City Camp Proper',
  'Country Club Village', 'Cresencia Village', 'Dagsian Lower', 'Dagsian Upper',
  'Dizon Subdivision', 'Dominican Hill-Mirador', 'Dontogan', 'DPS Area',
  'Engineers Hill', 'Fairview Village', 'Ferdinand', 'Fort del Pilar',
  'Gabriela Silang', 'General Luna Road', 'Gibraltar', 'Greenwater Village',
  'Guisad Central', 'Guisad Sorong', 'Happy Hollow', 'Happy Homes-Campo Sioco',
  'Harrison Road Central', 'Holy Ghost Extension', 'Holy Ghost Proper',
  'Honeymoon (Honeymoon Road)', 'House of Providence', 'Imelda R. Marcos',
  'Imelda Village', 'Irisan', 'Kabayanihan', 'Kagitingan', 'Kayang Extension',
  'Kayang-Hilltop', 'Kias', 'Legarda-Burnham-Kisad', 'Loakan Proper',
  'Lopez Jaena', 'Lourdes Subdivision Extension', 'Lourdes Subdivision Proper',
  'Lower Dagsian', 'Lower Magsaysay', 'Lower Rock Quarry', 'Lualhati',
  'Lucnab', 'Magsaysay Private Road', 'Magsaysay Lower', 'Magsaysay Upper',
  'Malcolm Square-Perfecto', 'Manuel A. Roxas', 'Market Subdivision Upper',
  'Middle Quezon Hill', 'Middle Rock Quarry', 'Military Cut-off', 'Mines View Park',
  'Modern Site East', 'Modern Site West', 'MRR-Queen of Peace', 'New Lucban',
  'Naguilian Road', 'Outlook Drive', 'Pacdal', 'Padre Burgos', 'Padre Zamora',
  'Palma-Urbano', 'Pinsao Pilot Project', 'Pinsao Proper', 'Poliwes', 'Pucsusan',
  'Quezon Hill Proper', 'Quezon Hill Upper', 'Quirino Hill East', 'Quirino Hill Lower',
  'Quirino Hill Middle', 'Quirino Hill West', 'Quirino-Magsaysay-Prieto-Dizon',
  'Rizal Monument Area', 'Rock Quarry Lower', 'Rock Quarry Middle', 'Rock Quarry Upper',
  'Roxas-Trinidad-Montilla', 'Sagpat', 'Saint Joseph Village', 'Salud Mitra',
  'San Antonio Village', 'San Luis Village', 'San Roque Village', 'San Vicente',
  'Sanitary Camp North', 'Sanitary Camp South', 'Santa Escolastica', 'Santo Rosario',
  'Santo Tomas Proper', 'Santo Tomas School Area', 'Scout Barrio', 'Session Road Area',
  'Slaughter House Area', 'SLU-SVP Housing Village', 'South Drive', 'Teodora Alonzo',
  'Trancoville', 'Upper Dagsian', 'Upper Magsaysay', 'Upper Market Subdivision',
  'Upper QM', 'Upper Rock Quarry', 'Victoria Village',
].sort();

/* ── Mock data ─────────────────────────────────────────────── */
const MOCK_CASES: CaseData[] = [
  { id: '1',  name: 'Juan dela Cruz',      barangay: 'Irisan',              age: 34, gender: 'Male',   lastSeen: '2024-03-15', imageUrl: '/assets/icons/UBlogo.png', status: 'missing',      verification: 'verified' },
  { id: '2',  name: 'Maria Santos',        barangay: 'Pacdal',              age: 17, gender: 'Female', lastSeen: '2024-04-02', imageUrl: '/assets/icons/UBlogo.png', status: 'missing',      verification: 'pending'  },
  { id: '3',  name: 'Unknown Male #001',   barangay: 'Camp 7',              age: 45, gender: 'Male',   lastSeen: '2024-01-20', imageUrl: '/assets/icons/UBlogo.png', status: 'unidentified', verification: 'verified' },
  { id: '4',  name: 'Pedro Reyes',         barangay: 'Bakakeng Central',    age: 8,  gender: 'Male',   lastSeen: '2024-05-10', imageUrl: '/assets/icons/UBlogo.png', status: 'found',        verification: 'verified' },
  { id: '5',  name: 'Ana Gonzales',        barangay: 'Lualhati',            age: 22, gender: 'Female', lastSeen: '2024-02-28', imageUrl: '/assets/icons/UBlogo.png', status: 'missing',      verification: 'pending'  },
  { id: '6',  name: 'Unknown Female #002', barangay: 'Lower Rock Quarry',   age: 30, gender: 'Female', lastSeen: '2024-03-05', imageUrl: '/assets/icons/UBlogo.png', status: 'unidentified', verification: 'pending'  },
  { id: '7',  name: 'Carlos Mendoza',      barangay: 'Engineers Hill',      age: 15, gender: 'Male',   lastSeen: '2024-04-18', imageUrl: '/assets/icons/UBlogo.png', status: 'missing',      verification: 'verified' },
  { id: '8',  name: 'Rosa Villanueva',     barangay: 'Mines View Park',     age: 60, gender: 'Female', lastSeen: '2024-01-09', imageUrl: '/assets/icons/UBlogo.png', status: 'found',        verification: 'verified' },
  { id: '9',  name: 'Unknown Male #003',   barangay: 'Quirino Hill East',   age: 25, gender: 'Male',   lastSeen: '2024-05-01', imageUrl: '/assets/icons/UBlogo.png', status: 'unidentified', verification: 'pending'  },
  { id: '10', name: 'Liza Fernandez',      barangay: 'Trancoville',         age: 11, gender: 'Female', lastSeen: '2024-03-22', imageUrl: '/assets/icons/UBlogo.png', status: 'missing',      verification: 'pending'  },
  { id: '11', name: 'Roberto Cruz',        barangay: 'Dagsian Lower',       age: 42, gender: 'Male',   lastSeen: '2024-02-14', imageUrl: '/assets/icons/UBlogo.png', status: 'missing',      verification: 'verified' },
  { id: '12', name: 'Elena Ramos',         barangay: 'Holy Ghost Proper',   age: 19, gender: 'Female', lastSeen: '2024-04-30', imageUrl: '/assets/icons/UBlogo.png', status: 'found',        verification: 'verified' },
];

/* ── Filter state type ─────────────────────────────────────── */
interface Filters {
  toggle: CaseStatus | 'all';
  search: string;
  barangay: string;
  ageRange: 'all' | 'children' | 'teens' | 'adults';
  genderMale: boolean;
  genderFemale: boolean;
}

const DEFAULT_FILTERS: Filters = {
  toggle: 'all',
  search: '',
  barangay: '',
  ageRange: 'all',
  genderMale: true,
  genderFemale: true,
};

/* ── Page component ────────────────────────────────────────── */
export default function BrowsePage() {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);

  function set<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters(prev => ({ ...prev, [key]: value }));
  }

  function resetFilters() {
    setFilters(DEFAULT_FILTERS);
  }

  /* Derived filtered list — memoised for performance */
  const filtered = useMemo(() => {
    return MOCK_CASES.filter(c => {
      if (filters.toggle !== 'all' && c.status !== filters.toggle) return false;
      if (filters.search && !c.name.toLowerCase().includes(filters.search.toLowerCase())) return false;
      if (filters.barangay && c.barangay !== filters.barangay) return false;
      if (filters.ageRange === 'children' && (c.age < 0  || c.age > 12)) return false;
      if (filters.ageRange === 'teens'    && (c.age < 13 || c.age > 19)) return false;
      if (filters.ageRange === 'adults'   && c.age < 20)                  return false;
      if (!filters.genderMale   && c.gender === 'Male')   return false;
      if (!filters.genderFemale && c.gender === 'Female') return false;
      return true;
    });
  }, [filters]);

  const TOGGLES: { label: string; value: Filters['toggle'] }[] = [
    { label: 'All',          value: 'all'          },
    { label: 'Missing',      value: 'missing'      },
    { label: 'Unidentified', value: 'unidentified' },
    { label: 'Found',        value: 'found'        },
  ];

  return (
    <>
      <Navbar />
      <main className="browse-page">

        {/* ── Header ── */}
        <header className="browse-header">
          <h1>Browse Cases</h1>
          <p>Search and filter missing and unidentified persons in Baguio City</p>

          {/* Toggle */}
          <div className="browse-toggle" role="group" aria-label="Filter by case type">
            {TOGGLES.map(t => (
              <button
                key={t.value}
                className={`browse-toggle-btn${filters.toggle === t.value ? ' active' : ''}`}
                onClick={() => set('toggle', t.value)}
                aria-pressed={filters.toggle === t.value}
              >
                {t.label}
              </button>
            ))}
          </div>
        </header>

        {/* ── Layout ── */}
        <div className="browse-layout">

          {/* ── Sidebar ── */}
          <aside className="browse-sidebar" aria-label="Filters">
            <h2 className="sidebar-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
              </svg>
              Filters
            </h2>

            {/* Search */}
            <div className="filter-group">
              <span className="filter-label">Search Name</span>
              <div className="filter-search">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input
                  type="text"
                  placeholder="Enter name..."
                  value={filters.search}
                  onChange={e => set('search', e.target.value)}
                  aria-label="Search by name"
                />
              </div>
            </div>

            {/* Barangay */}
            <div className="filter-group">
              <span className="filter-label">Barangay</span>
              <select
                className="filter-select"
                value={filters.barangay}
                onChange={e => set('barangay', e.target.value)}
                aria-label="Filter by barangay"
              >
                <option value="">All Barangays</option>
                {BARANGAYS.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            {/* Age range */}
            <div className="filter-group">
              <span className="filter-label">Age Range</span>
              <div className="filter-options" role="radiogroup" aria-label="Age range">
                {([
                  { value: 'all',      label: 'All Ages'        },
                  { value: 'children', label: 'Children (0–12)' },
                  { value: 'teens',    label: 'Teens (13–19)'   },
                  { value: 'adults',   label: 'Adults (20+)'    },
                ] as const).map(opt => (
                  <label key={opt.value} className="filter-option">
                    <input
                      type="radio"
                      name="ageRange"
                      value={opt.value}
                      checked={filters.ageRange === opt.value}
                      onChange={() => set('ageRange', opt.value)}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Gender */}
            <div className="filter-group">
              <span className="filter-label">Gender</span>
              <div className="filter-options">
                <label className="filter-option">
                  <input
                    type="checkbox"
                    checked={filters.genderMale}
                    onChange={e => set('genderMale', e.target.checked)}
                  />
                  Male
                </label>
                <label className="filter-option">
                  <input
                    type="checkbox"
                    checked={filters.genderFemale}
                    onChange={e => set('genderFemale', e.target.checked)}
                  />
                  Female
                </label>
              </div>
            </div>

            {/* Clear */}
            <button className="filter-clear" onClick={resetFilters}>
              Clear All Filters
            </button>
          </aside>

          {/* ── Gallery ── */}
          <section className="browse-gallery" aria-label="Case results">
            <div className="gallery-meta">
              <p className="gallery-count">
                Showing <strong>{filtered.length}</strong> of <strong>{MOCK_CASES.length}</strong> cases
              </p>
            </div>

            {filtered.length > 0 ? (
              <div className="case-grid">
                {filtered.map(c => (
                  <CaseCard key={c.id} data={c} />
                ))}
              </div>
            ) : (
              <div className="browse-empty" role="status" aria-live="polite">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                  <circle cx="11" cy="11" r="8"/>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  <line x1="8" y1="11" x2="14" y2="11"/>
                </svg>
                <h3>No Cases Found</h3>
                <p>No cases match your current filters. Try adjusting your search criteria.</p>
                <button className="browse-empty-reset" onClick={resetFilters}>
                  Reset Filters
                </button>
              </div>
            )}
          </section>

        </div>
      </main>
    </>
  );
}
