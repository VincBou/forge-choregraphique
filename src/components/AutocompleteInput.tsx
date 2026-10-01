import { useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { normalizeSearch } from '../lib/project';

type Props = {
  id: string;
  label: string;
  value: string;
  suggestions: string[];
  placeholder?: string;
  maxLength?: number;
  required?: boolean;
  commaDelimited?: boolean;
  className?: string;
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
  commaDelimited = false,
  className,
  onChange,
  onBlur,
}: Props) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [caret, setCaret] = useState(value.length);
  const [pendingCaret, setPendingCaret] = useState<number | null>(null);
  useLayoutEffect(() => {
    if (pendingCaret === null) return;
    inputRef.current?.setSelectionRange(pendingCaret, pendingCaret);
    setCaret(pendingCaret);
    setPendingCaret(null);
  }, [pendingCaret, value]);
  const segment = useMemo(() => {
    if (!commaDelimited) return { start: 0, end: value.length, text: value };
    const position = Math.min(caret, value.length);
    const before = value.slice(0, position).lastIndexOf(',') + 1;
    const nextComma = value.indexOf(',', position);
    const end = nextComma < 0 ? value.length : nextComma;
    return { start: before, end, text: value.slice(before, end) };
  }, [caret, commaDelimited, value]);
  const filtered = useMemo(() => {
    const query = normalizeSearch(segment.text.trim());
    return suggestions.filter((suggestion) => !query || normalizeSearch(suggestion).includes(query));
  }, [segment.text, suggestions]);
  const visible = filtered.slice(0, 8);

  function selectSuggestion(suggestion: string) {
    if (!commaDelimited) {
      onChange(suggestion);
      setOpen(false);
      return;
    }
    const start = segment.start;
    const end = segment.end;
    const oldSegment = value.slice(start, end);
    const leadingLength = oldSegment.length - oldSegment.trimStart().length;
    const trailingLength = oldSegment.length - oldSegment.trimEnd().length;
    const leading = oldSegment.slice(0, leadingLength);
    const trailing = oldSegment.slice(Math.max(leadingLength, oldSegment.length - trailingLength));
    const replacement = `${leading}${suggestion}${trailing}`;
    const nextValue = `${value.slice(0, start)}${replacement}${value.slice(end)}`;
    if (nextValue.length > maxLength) return;
    const nextCaret = start + leading.length + suggestion.length;
    onChange(nextValue);
    setPendingCaret(nextCaret);
    setOpen(false);
  }

  return (
    <div className={`autocomplete${className ? ` ${className}` : ''}`}>
      <label className="sr-only" htmlFor={id}>{label}</label>
      <input
        ref={inputRef}
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
        onFocus={(event) => { setCaret(event.currentTarget.selectionStart ?? value.length); setOpen(true); setActiveIndex(-1); }}
        onBlur={(event) => {
          onBlur?.(event.currentTarget.value);
          window.setTimeout(() => setOpen(false), 100);
        }}
        onChange={(event) => { onChange(event.target.value); setCaret(event.currentTarget.selectionStart ?? event.currentTarget.value.length); setOpen(true); setActiveIndex(-1); }}
        onClick={(event) => setCaret(event.currentTarget.selectionStart ?? value.length)}
        onSelect={(event) => setCaret(event.currentTarget.selectionStart ?? value.length)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false);
          if (event.key === 'ArrowDown' && visible.length) {
            event.preventDefault();
            setOpen(true);
            setActiveIndex((current) => (current + 1) % visible.length);
          }
          if (event.key === 'ArrowUp' && visible.length) {
            event.preventDefault();
            setOpen(true);
            setActiveIndex((current) => current <= 0 ? visible.length - 1 : current - 1);
          }
          if (event.key === 'Enter' && open && visible[activeIndex >= 0 ? activeIndex : 0]) {
            event.preventDefault();
            selectSuggestion(visible[activeIndex >= 0 ? activeIndex : 0]);
          }
        }}
      />
      {open && visible.length > 0 && (
        <ul id={listId} className="suggestions" role="listbox" aria-label={`Suggestions pour ${label}`}>
          {visible.map((suggestion, index) => (
            <li
              id={`${listId}-option-${index}`}
              key={`${suggestion}-${index}`}
              role="option"
              aria-selected={activeIndex === index}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => selectSuggestion(suggestion)}
            >
              {suggestion}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
