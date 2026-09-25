import { describe, expect, it } from 'vitest';
import {
  defaultDraft,
  formatProject,
  getExportError,
  isProjectDraft,
  LEGACY_STORAGE_KEY,
  loadDraft,
  migrateLegacyDraft,
  normalizeSearch,
  normalizeSingleLine,
  PREVIOUS_STORAGE_KEY,
  STORAGE_KEY,
  type ChoreographyLine,
  type MovementCategory,
} from './project';

const line = (fields: Partial<ChoreographyLine> = {}): ChoreographyLine => ({
  id: 'line-1', attacker: 'Combattant A', handMovement: 'Parade', footMovement: '', details: '', defender: '', defenderMovement: '', defenderDetails: '', ...fields,
});

describe('project formatting and validation', () => {
  it('starts with the two default fighters and one empty line', () => {
    const draft = defaultDraft();
    expect(draft.fighters).toEqual(['Combattant A', 'Combattant B']);
    expect(draft.lines).toHaveLength(1);
    expect(getExportError(draft.lines)).toMatch(/au moins une action/i);
  });

  it('ignores empty lines and numbers exported actions', () => {
    expect(formatProject([
      line(),
      line({ id: 'empty', attacker: '', handMovement: '', footMovement: '', details: '', defender: '' }),
      line({ id: 'two', attacker: 'B', handMovement: 'Riposte', footMovement: 'Marche', details: 'en avançant', defender: 'A', defenderMovement: 'Esquive', defenderDetails: 'sur le côté' }),
    ])).toBe('1. Combattant A Parade\n2. B Riposte Marche en avançant contre A qui Esquive sur le côté');
  });

  it('exports reaction movement or detail only when a defender is present', () => {
    expect(formatProject([line({ defender: 'B', defenderDetails: 'se protège' })])).toBe('1. Combattant A Parade contre B qui se protège');
    expect(formatProject([line({ defender: 'B', defenderMovement: 'Parade' })])).toBe('1. Combattant A Parade contre B qui Parade');
    expect(formatProject([line({ defender: '', defenderMovement: 'Parade', defenderDetails: 'se protège' })])).toBe('1. Combattant A Parade');
  });

  it('requires an attacker and at least one movement on each started line', () => {
    expect(getExportError([line(), line({ id: 'empty', attacker: '', handMovement: '', footMovement: '', details: '', defender: '' })])).toBeNull();
    expect(getExportError([line({ attacker: '', details: 'en reculant' })])).toMatch(/attaquant/i);
    expect(getExportError([line({ handMovement: '', details: 'en reculant' })])).toMatch(/mouvement de main ou de pieds/i);
    expect(getExportError([line({ id: 'empty', attacker: '', handMovement: '', footMovement: '', details: '', defender: '' }), line({ id: 'second', handMovement: '', footMovement: '' })])).toMatch(/ligne 2/i);
    expect(getExportError([line({ handMovement: '', footMovement: 'Retraite' })])).toBeNull();
  });

  it('normalizes fields as single-line text without treating markup as executable', () => {
    const html = '<img src=x onerror=alert(1)>';
    expect(normalizeSingleLine(`${html}\nnext`, 100)).toBe(`${html}next`);
    expect(normalizeSingleLine('x'.repeat(120), 100)).toHaveLength(100);
  });

  it('normalizes accent and case for suggestion matching', () => {
    expect(normalizeSearch('ÉCH')).toBe('ech');
    expect(normalizeSearch('echelle')).toBe('echelle');
  });

  it('rejects malformed or oversized persisted drafts', () => {
    expect(isProjectDraft({ fighters: [], lines: [{ id: 'a', attacker: 'x\ny', handMovement: '', footMovement: '', details: '', defender: '' }] })).toBe(false);
    expect(isProjectDraft({ fighters: Array(51).fill('x'), lines: [] })).toBe(false);
  });

  it('recovers from malformed or inaccessible local storage', () => {
    const malformed = loadDraft({ getItem: (key) => key === STORAGE_KEY ? '{not json' : null, setItem: () => undefined, removeItem: () => undefined });
    expect(malformed.warning).toMatch(/invalide|illisible/i);
    expect(malformed.draft.fighters).toEqual(['Combattant A', 'Combattant B']);

    const denied = loadDraft({ getItem: () => { throw new Error('denied'); }, setItem: () => undefined, removeItem: () => undefined });
    expect(denied.warning).toMatch(/stockage local/i);
  });

  it('reads a valid saved draft from the expected storage key', () => {
    const saved = { fighters: ['A'], lines: [line()] };
    const loaded = loadDraft({ getItem: (key) => key === STORAGE_KEY ? JSON.stringify(saved) : null, setItem: () => undefined, removeItem: () => undefined });
    expect(loaded.draft).toEqual(saved);
    expect(loaded.warning).toBeNull();
  });

  it('migrates known legacy movements by category and keeps unknown actions in the hand field', () => {
    const categories = new Map<string, MovementCategory>([
      ['marche', 'pieds'],
      ['parade', 'main'],
    ]);
    const legacy = {
      fighters: ['A', 'B'],
      lines: [
        { id: 'known-foot', attacker: 'A', action: 'Marche', details: '', defender: 'B' },
        { id: 'known-hand', attacker: 'B', action: 'Parade', details: '', defender: 'A' },
        { id: 'free', attacker: 'A', action: 'Mouvement libre', details: '', defender: '' },
      ],
    };
    const migrated = migrateLegacyDraft(legacy, categories);
    expect(migrated.lines[0]).toMatchObject({ handMovement: '', footMovement: 'Marche' });
    expect(migrated.lines[1]).toMatchObject({ handMovement: 'Parade', footMovement: '' });
    expect(migrated.lines[2]).toMatchObject({ handMovement: 'Mouvement libre', footMovement: '' });
  });

  it('persists the migrated draft under v3 before removing the v1 key', () => {
    const values = new Map([[LEGACY_STORAGE_KEY, JSON.stringify({
      fighters: ['A'],
      lines: [{ id: 'legacy', attacker: 'A', action: 'Marche', details: '', defender: '' }],
    })]]);
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
      removeItem: (key: string) => { values.delete(key); },
    };
    const loaded = loadDraft(storage, new Map([['marche', 'pieds']]));
    expect(loaded.migrated).toBe(true);
    expect(loaded.draft.lines[0].footMovement).toBe('Marche');
    expect(values.has(STORAGE_KEY)).toBe(true);
    expect(values.has(LEGACY_STORAGE_KEY)).toBe(false);
  });

  it('migrates v2 drafts by adding empty defender reaction fields', () => {
    const values = new Map([[PREVIOUS_STORAGE_KEY, JSON.stringify({
      fighters: ['A', 'B'],
      lines: [{ id: 'prior', attacker: 'A', handMovement: 'Parade', footMovement: '', details: '', defender: 'B' }],
    })]]);
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
      removeItem: (key: string) => { values.delete(key); },
    };
    const loaded = loadDraft(storage);
    expect(loaded.draft.lines[0]).toMatchObject({ defender: 'B', defenderMovement: '', defenderDetails: '' });
    expect(values.has(STORAGE_KEY)).toBe(true);
    expect(values.has(PREVIOUS_STORAGE_KEY)).toBe(false);
  });
});
