'use client';

export interface IdentityData {
  name: string;
  nickname: string;
  approximateAge: string;
  gender: string;
  physicalDescription: string;
}

interface StepIdentityProps {
  type: 'missing' | 'unidentified';
  data: IdentityData;
  onChange: (data: IdentityData) => void;
  errors: Partial<Record<keyof IdentityData, string>>;
}

const GENDER_OPTIONS = ['Male', 'Female', 'Unknown / Undetermined'];

export function StepIdentity({ type, data, onChange, errors }: StepIdentityProps) {
  const set = (field: keyof IdentityData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      onChange({ ...data, [field]: e.target.value });

  if (type === 'missing') {
    return (
      <div>
        <h2 className="form-card-title">Person Information</h2>
        <p className="form-card-subtitle">
          Provide as much detail as possible about the missing person.
        </p>

        {/* Name */}
        <div className="form-group">
          <label className="form-label" htmlFor="identity-name">
            Full Name <span className="required-star">*</span>
          </label>
          <input
            id="identity-name"
            type="text"
            className={`form-input${errors.name ? ' error' : ''}`}
            value={data.name}
            onChange={set('name')}
            placeholder="Enter full name"
            autoComplete="off"
          />
          {errors.name && <span className="form-error">{errors.name}</span>}
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

        {/* Age + Gender row */}
        <div className="form-row">
          <div className="form-group">
            <label className="form-label" htmlFor="identity-age">
              Age <span className="required-star">*</span>
            </label>
            <input
              id="identity-age"
              type="number"
              min="0"
              max="120"
              className={`form-input${errors.approximateAge ? ' error' : ''}`}
              value={data.approximateAge}
              onChange={set('approximateAge')}
              placeholder="e.g. 25"
            />
            {errors.approximateAge && (
              <span className="form-error">{errors.approximateAge}</span>
            )}
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
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
            {errors.gender && <span className="form-error">{errors.gender}</span>}
          </div>
        </div>
      </div>
    );
  }

  /* ── Unidentified ─────────────────────────────────────── */
  return (
    <div>
      <h2 className="form-card-title">Unidentified Person Details</h2>
      <p className="form-card-subtitle">
        Describe the physical characteristics of the unidentified person.
      </p>

      {/* Age + Gender row */}
      <div className="form-row">
        <div className="form-group">
          <label className="form-label" htmlFor="identity-approx-age">
            Approximate Age <span className="required-star">*</span>
          </label>
          <input
            id="identity-approx-age"
            type="text"
            className={`form-input${errors.approximateAge ? ' error' : ''}`}
            value={data.approximateAge}
            onChange={set('approximateAge')}
            placeholder="e.g. 30–40"
          />
          {errors.approximateAge && (
            <span className="form-error">{errors.approximateAge}</span>
          )}
        </div>

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
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
          {errors.gender && <span className="form-error">{errors.gender}</span>}
        </div>
      </div>

      {/* Physical description */}
      <div className="form-group">
        <label className="form-label" htmlFor="identity-physical">
          Physical Description <span className="required-star">*</span>
        </label>
        <textarea
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
