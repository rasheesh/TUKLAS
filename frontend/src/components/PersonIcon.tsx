/* ── Shared person silhouette icon ──────────────────────────────
   Used wherever a case photo placeholder is needed.
   gender: 'Male' | 'Female' | string (falls back to male shape)
   status: drives background tint and icon color
   ─────────────────────────────────────────────────────────────── */

export type IconStatus = 'missing' | 'unidentified' | 'found';

const STATUS_BG: Record<IconStatus, string> = {
  missing:      '#f5e8e8',
  unidentified: '#fef3e2',
  found:        '#e8f5ee',
};

const STATUS_COLOR: Record<IconStatus, string> = {
  missing:      '#c0392b',
  unidentified: '#d35400',
  found:        '#1e8449',
};

interface PersonIconProps {
  gender: string;
  status: IconStatus;
  /** Container size in px — icon SVG scales to fill it */
  size?: number;
  /** Extra inline styles on the wrapper div */
  style?: React.CSSProperties;
  className?: string;
}

export function PersonIcon({ gender, status, size, style, className }: PersonIconProps) {
  const bg    = STATUS_BG[status]    ?? '#f0f0f0';
  const color = STATUS_COLOR[status] ?? '#888';
  const isFemale = gender?.toLowerCase() === 'female';

  const wrapStyle: React.CSSProperties = {
    background: bg,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width:  size ? `${size}px` : '100%',
    height: size ? `${size}px` : '100%',
    flexShrink: 0,
    ...style,
  };

  return (
    <div style={wrapStyle} className={className} aria-hidden="true">
      {isFemale ? (
        <svg viewBox="0 0 80 100" fill="none" xmlns="http://www.w3.org/2000/svg"
          style={{ width: '52%', height: '52%' }}>
          <circle cx="40" cy="22" r="16" fill={color} opacity="0.85" />
          <path d="M18 100 C18 72 28 58 40 55 C52 58 62 72 62 100Z" fill={color} opacity="0.75" />
          <path d="M26 56 Q40 48 54 56 L58 70 Q40 64 22 70Z" fill={color} opacity="0.85" />
        </svg>
      ) : (
        <svg viewBox="0 0 80 100" fill="none" xmlns="http://www.w3.org/2000/svg"
          style={{ width: '52%', height: '52%' }}>
          <circle cx="40" cy="22" r="16" fill={color} opacity="0.85" />
          <rect x="24" y="52" width="32" height="28" rx="4" fill={color} opacity="0.85" />
          <rect x="24" y="78" width="13" height="22" rx="3" fill={color} opacity="0.75" />
          <rect x="43" y="78" width="13" height="22" rx="3" fill={color} opacity="0.75" />
        </svg>
      )}
    </div>
  );
}
