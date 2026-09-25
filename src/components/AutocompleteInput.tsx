import { useId, useMemo, useState } from 'react';
import { normalizeSearch } from '../lib/project';

type Props = {
  id: string;
  label: string;
  value: string;
  suggestions: string[];
  placeholder?: string;
  maxLength?: number;
  required?: boolean;
  onChange: (value: string) => void;
  onBlur?: (value: string) => void;
};

export default function AutocompleteInput({
  id,
  label,
  value,
  suggestions,
  placeholder,
  maxLength = 100,
  required = false,
  onChange,
  onBlur,
}: Props) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const filtered = useMemo(() => {
    const query = normalizeSearch(value.trim());
    return suggestions.filter((suggestion) => !query || normalizeSearch(suggestion).includes(query));
  }, [suggestions, value]);

  return (
    <div className="autocomplete">
      <label className="sr-only" htmlFor={id}>{label}</label>
      <input
        id={id}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-required={required || undefined}
        aria-expanded={open && filtered.length > 0}
        aria-controls={listId}
        aria-activedescendant={open && activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined}
        autoComplete="off"
        maxLength={maxLength}
        required={required}
        value={value}
        placeholder={placeholder}
        onFocus={() => { setOpen(true); setActiveIndex(-1); }}
        onBlur={(event) => {
          onBlur?.(event.currentTarget.value);
          window.setTimeout(() => setOpen(false), 100);
        }}
        onChange={(event) => { onChange(event.target.value); setOpen(true); setActiveIndex(-1); }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false);
          if (event.key === 'ArrowDown' && filtered.length) {
            event.preventDefault();
            setOpen(true);
            setActiveIndex((current) => (current + 1) % filtered.length);
          }
          if (event.key === 'ArrowUp' && filtered.length) {
            event.preventDefault();
            setOpen(true);
            setActiveIndex((current) => current <= 0 ? filtered.length - 1 : current - 1);
          }
          if (event.key === 'Enter' && open && filtered[activeIndex >= 0 ? activeIndex : 0]) {
            event.preventDefault();
            onChange(filtered[activeIndex >= 0 ? activeIndex : 0]);
            setOpen(false);
          }
        }}
      />
      {open && filtered.length > 0 && (
        <ul id={listId} className="suggestions" role="listbox" aria-label={`Suggestions pour ${label}`}>
          {filtered.slice(0, 8).map((suggestion, index) => (
            <li
              id={`${listId}-option-${index}`}
              key={`${suggestion}-${index}`}
              role="option"
              aria-selected={activeIndex === index}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => { onChange(suggestion); setOpen(false); }}
            >
              {suggestion}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
