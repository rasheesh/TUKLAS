'use client';

export interface IdentityData {
  /* Missing person — known identity */
  firstName: string;
  lastName: string;
  nickname: string;
  /* Unidentified — estimated age range (two separate numbers) */
  ageMin: string;
  ageMax: string;
  gender: string;
  heightFt: string;   // decimal feet, e.g. "5.75" = 5'9"
  physicalDescription: string;
}

interface StepIdentityProps {
  type: 'missing' | 'unidentified';
  data: IdentityData;
  onChange: (data: IdentityData) => void;
  errors: Partial<Record<keyof IdentityData, string>>;
}

/* value = DB enum value, label = display text */
const GENDER_OPTIONS: { value: string; label: string }[] = [
  { value: 'MALE',    label: 'Male' },
  { value: 'FEMALE',  label: 'Female' },
  { value: 'UNKNOWN', label: 'Unknown / Undetermined' },
];

/* Convert decimal feet string → { feet, inches } for display */
function decimalToFeetInches(val: string): { feet: string; inches: string } {
  if (!val) return { feet: '', inches: '' };
  const total = parseFloat(val);
  if (isNaN(total)) return { feet: '', inches: '' };
  const ft = Math.floor(total);
  const inches = Math.round((total - ft) * 12);
  return { feet: String(ft), inches: String(inches) };
}

/* Convert feet + inches → decimal feet string */
function feetInchesToDecimal(feet: string, inches: string): string {
  if (!feet) return '';
  const ft = parseInt(feet);
  const inch = parseInt(inches || '0');
  return (ft + inch / 12).toFixed(4);
}

/* Height picker — two selects: feet and inches */
function HeightPicker({
  value,
  onChange,
  id,
}: {
  value: string;
  onChange: (val: string) => void;
  id: string;
}) {
  const { feet, inches } = decimalToFeetInches(value);

  const handleFeet = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(feetInchesToDecimal(e.target.value, inches));
  };
  const handleInches = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(feetInchesToDecimal(feet, e.target.value));
  };

  return (
    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
      <select
        id={id}
        className="form-select"
        value={feet}
        onChange={handleFeet}
        aria-label="Feet"
        style={{ flex: 1 }}
      >
        <option value="">ft</option>
        {[3, 4, 5, 6, 7].map(f => (
          <option key={f} value={f}>{f} ft</option>
        ))}
      </select>
      <select
        className="form-select"
        value={inches}
        onChange={handleInches}
        aria-label="Inches"
        disabled={!feet}
        style={{ flex: 1 }}
      >
        {Array.from({ length: 12 }, (_, i) => (
          <option key={i} value={i}>{i} in</option>
        ))}
      </select>
      {feet && (
        <span style={{ fontSize: '0.8rem', color: 'var(--color-text-light)', whiteSpace: 'nowrap', minWidth: '3rem' }}>
          {feet}′{inches || '0'}″
        </span>
      )}
    </div>
  );
}

export function StepIdentity({ type, data, onChange, errors }: StepIdentityProps) {
  const set = (field: keyof IdentityData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      onChange({ ...data, [field]: e.target.value });

  /* ── Missing person ─────────────────────────────────────── */
  if (type === 'missing') {
    return (
      <div>
        <h2 className="form-card-title">Person Information</h2>
        <p className="form-card-subtitle">
          Provide as much detail as possible about the missing person.
        </p>

        {/* First name + Last name */}
        <div className="form-row">
          <div className="form-group">
            <label className="form-label" htmlFor="identity-firstname">
              First Name <span className="required-star">*</span>
            </label>
            <input
              id="identity-firstname"
              type="text"
              className={`form-input${errors.firstName ? ' error' : ''}`}
              value={data.firstName}
              onChange={set('firstName')}
              placeholder="e.g. Juan"
              autoComplete="off"
            />
            {errors.firstName && <span className="form-error">{errors.firstName}</span>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="identity-lastname">
              Last Name <span className="required-star">*</span>
            </label>
            <input
              id="identity-lastname"
              type="text"
              className={`form-input${errors.lastName ? ' error' : ''}`}
              value={data.lastName}
              onChange={set('lastName')}
              placeholder="e.g. dela Cruz"
              autoComplete="off"
            />
            {errors.lastName && <span className="form-error">{errors.lastName}</span>}
          </div>
        </div>

        {/* Nickname */}
        <div className="form-group">
          <label className="form-label" htmlFor="identity-nickname">
            Nickname / Alias
          </label>
          <input
            id="identity-nickname"
            type="text"
            className="form-input"
            value={data.nickname}
            onChange={set('nickname')}
            placeholder="Optional"
            autoComplete="off"
          />
        </div>

        {/* Age + Gender */}
        <div className="form-row">
          <div className="form-group">
            <label className="form-label" htmlFor="identity-age-min">
              Age <span className="required-star">*</span>
            </label>
            <input
              id="identity-age-min"
              type="number"
              min="0"
              max="120"
              className={`form-input${errors.ageMin ? ' error' : ''}`}
              value={data.ageMin}
              onChange={set('ageMin')}
              placeholder="e.g. 25"
            />
            {errors.ageMin && <span className="form-error">{errors.ageMin}</span>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="identity-gender">
              Gender <span className="required-star">*</span>
            </label>
            <select
              id="identity-gender"
              className={`form-select${errors.gender ? ' error' : ''}`}
              value={data.gender}
              onChange={set('gender')}
            >
              <option value="">Select gender</option>
              {GENDER_OPTIONS.map((g) => (
                <option key={g.value} value={g.value}>{g.label}</option>
              ))}
            </select>
            {errors.gender && <span className="form-error">{errors.gender}</span>}
          </div>
        </div>

        {/* Height — optional for missing */}
        <div className="form-group">
          <label className="form-label" htmlFor="identity-height-missing">
            Height
            <span className="form-label-optional"> (Optional)</span>
          </label>
          <HeightPicker
            id="identity-height-missing"
            value={data.heightFt}
            onChange={val => onChange({ ...data, heightFt: val })}
          />
        </div>

        {/* Physical description — optional for missing, aids case matching */}
        <div className="form-group">
          <label className="form-label" htmlFor="identity-physical-missing">
            Physical Description
            <span className="form-label-optional"> (Recommended)</span>
          </label>          <textarea
            id="identity-physical-missing"
            className="form-textarea"
            value={data.physicalDescription}
            onChange={set('physicalDescription')}
            placeholder="Describe height, build, hair color, eye color, distinguishing marks, scars, tattoos, last known clothing…"
            rows={4}
          />
          <span className="form-hint" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.35rem' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12" aria-hidden="true">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            A detailed description significantly improves the chance of a match with unidentified persons.
          </span>
        </div>
      </div>
    );
  }

  /* ── Unidentified person ────────────────────────────────── */
  return (
    <div>
      <h2 className="form-card-title">Unidentified Person Details</h2>
      <p className="form-card-subtitle">
        Describe the physical characteristics of the unidentified person.
      </p>

      {/* Estimated age range — two separate number inputs */}
      <div className="form-group">
        <span className="form-label">
          Estimated Age Range <span className="required-star">*</span>
        </span>
        <div className="form-row" style={{ marginTop: '0.4rem' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label form-label-sub" htmlFor="identity-age-min">
              From
            </label>
            <input
              id="identity-age-min"
              type="number"
              min="0"
              max="120"
              className={`form-input${errors.ageMin ? ' error' : ''}`}
              value={data.ageMin}
              onChange={set('ageMin')}
              placeholder="e.g. 30"
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label form-label-sub" htmlFor="identity-age-max">
              To
            </label>
            <input
              id="identity-age-max"
              type="number"
              min="0"
              max="120"
              className={`form-input${errors.ageMax ? ' error' : ''}`}
              value={data.ageMax}
              onChange={set('ageMax')}
              placeholder="e.g. 40"
            />
          </div>
        </div>
        {(errors.ageMin || errors.ageMax) && (
          <span className="form-error">{errors.ageMin || errors.ageMax}</span>
        )}
      </div>

      {/* Gender */}
      <div className="form-group">
        <label className="form-label" htmlFor="identity-gender-u">
          Gender <span className="required-star">*</span>
        </label>
        <select
          id="identity-gender-u"
          className={`form-select${errors.gender ? ' error' : ''}`}
          value={data.gender}
          onChange={set('gender')}
        >
          <option value="">Select gender</option>
          {GENDER_OPTIONS.map((g) => (
            <option key={g.value} value={g.value}>{g.label}</option>
          ))}
        </select>
        {errors.gender && <span className="form-error">{errors.gender}</span>}
      </div>

      {/* Height — optional for unidentified */}
      <div className="form-group">
        <label className="form-label" htmlFor="identity-height-u">
          Approximate Height
          <span className="form-label-optional"> (Optional)</span>
        </label>
        <HeightPicker
          id="identity-height-u"
          value={data.heightFt}
          onChange={val => onChange({ ...data, heightFt: val })}
        />
      </div>

      {/* Physical description */}
      <div className="form-group">
        <label className="form-label" htmlFor="identity-physical">
          Physical Description <span className="required-star">*</span>
        </label>        <textarea
          id="identity-physical"
          className={`form-textarea${errors.physicalDescription ? ' error' : ''}`}
          value={data.physicalDescription}
          onChange={set('physicalDescription')}
          placeholder="Describe height, build, hair color, eye color, scars, tattoos, clothing when found..."
          rows={5}
        />
        {errors.physicalDescription && (
          <span className="form-error">{errors.physicalDescription}</span>
        )}
      </div>
    </div>
  );
}
