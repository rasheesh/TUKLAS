'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';

interface BarangayComboboxProps {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  error?: boolean;
  id?: string;
  placeholder?: string;
}

/**
 * Accessible single-select combobox for picking a barangay.
 *
 * Type to filter; click or use the keyboard (↑/↓/Enter/Esc) to choose. Shows a
 * clear button once a value is selected. Replaces the old search-input +
 * <select size=5> listbox with a single, familiar autocomplete control.
 */
export function BarangayCombobox({
  options,
  value,
  onChange,
  error = false,
  id,
  placeholder = 'Type to search barangays…',
}: BarangayComboboxProps) {
  const reactId = useId();
  const baseId = id ?? `barangay-${reactId}`;
  const listboxId = `${baseId}-listbox`;

  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  /* Keep the input text in sync if the value is changed from outside
     (e.g. restoring a saved draft). */
  useEffect(() => {
    setQuery(value);
  }, [value]);

  /* When the query matches the selected value (or is empty) show the full
     list; otherwise filter by substring. */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q === '' || query === value) return options;
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [query, value, options]);

  /* Close on outside click. */
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery(value);   // discard any partial typing
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open, value]);

  /* Keep the highlighted option scrolled into view. */
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLLIElement>(`[data-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  const openList = () => {
    setOpen(true);
    /* Highlight the current selection if present, else the first item. */
    const idx = filtered.findIndex((o) => o === value);
    setActiveIndex(idx >= 0 ? idx : 0);
  };

  const selectOption = (option: string) => {
    onChange(option);
    setQuery(option);
    setOpen(false);
    inputRef.current?.focus();
  };

  const clear = () => {
    onChange('');
    setQuery('');
    setOpen(true);
    setActiveIndex(0);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!open) { openList(); return; }
        setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (!open) { openList(); return; }
        setActiveIndex((i) => Math.max(i - 1, 0));
        break;
      case 'Enter':
        if (open && filtered[activeIndex]) {
          e.preventDefault();
          selectOption(filtered[activeIndex]);
        }
        break;
      case 'Escape':
        if (open) {
          e.preventDefault();
          setOpen(false);
          setQuery(value);
        }
        break;
      case 'Tab':
        setOpen(false);
        setQuery(value);
        break;
    }
  };

  return (
    <div className="barangay-combobox" ref={wrapperRef}>
      <div className="barangay-combobox-control">
        <span className="barangay-combobox-search-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
            <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </span>
        <input
          ref={inputRef}
          id={baseId}
          type="text"
          className={`form-input barangay-combobox-input${error ? ' error' : ''}`}
          value={query}
          placeholder={placeholder}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActiveIndex(0);
          }}
          onFocus={openList}
          onKeyDown={handleKeyDown}
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={open && filtered[activeIndex] ? `${baseId}-opt-${activeIndex}` : undefined}
          autoComplete="off"
        />
        {value && (
          <button
            type="button"
            className="barangay-combobox-clear"
            onClick={clear}
            aria-label="Clear selected barangay"
            tabIndex={-1}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {open && (
        <ul
          ref={listRef}
          id={listboxId}
          className="barangay-combobox-list"
          role="listbox"
          aria-label="Barangays"
        >
          {filtered.length === 0 ? (
            <li className="barangay-combobox-empty" role="presentation">
              No barangay matches “{query.trim()}”.
            </li>
          ) : (
            filtered.map((option, i) => (
              <li
                key={option}
                id={`${baseId}-opt-${i}`}
                data-index={i}
                role="option"
                aria-selected={option === value}
                className={
                  `barangay-combobox-option${i === activeIndex ? ' active' : ''}` +
                  (option === value ? ' selected' : '')
                }
                onMouseDown={(e) => {
                  /* mousedown (not click) so it fires before input blur */
                  e.preventDefault();
                  selectOption(option);
                }}
                onMouseEnter={() => setActiveIndex(i)}
              >
                {option === value && (
                  <svg className="barangay-combobox-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" width="14" height="14" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
                <span>{option}</span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
