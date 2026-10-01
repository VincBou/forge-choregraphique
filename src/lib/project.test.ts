import { describe, expect, it } from 'vitest';
import {
  calculateOppositionDuration,
  defaultDraft,
  formatProject,
  getExportError,
  isProjectDraft,
  LEGACY_STORAGE_KEY,
  loadDraft,
  migrateLegacyDraft,
  normalizeSearch,
  normalizeMultiLine,
  normalizeSingleLine,
  OLDER_STORAGE_KEY,
  PREVIOUS_STORAGE_KEY,
  STORAGE_KEY,
  V4_STORAGE_KEY,
  type ChoreographyLine,
  type MovementCategory,
} from './project';

const line = (fields: Partial<ChoreographyLine> = {}): ChoreographyLine => ({
  id: 'line-1', attacker: 'Combattant A', handMovement: 'Parade', footMovement: '', details: '', defender: '', defenderMovement: '', defenderDetails: '', ...fields,
});
const draftWithLines = (lines: ChoreographyLine[]) => {
  const draft = defaultDraft();
  return { ...draft, phrases: [{ ...draft.phrases[0], lines }] };
};

describe('project formatting and validation', () => {
  it('starts with the two default fighters and one empty line', () => {
    const draft = defaultDraft();
    expect(draft.fighters.map(({ name }) => name)).toEqual(['Combattant A', 'Combattant B']);
    expect(draft.phrases).toHaveLength(1);
    expect(draft.phrases[0].lines).toHaveLength(1);
    expect(getExportError(draft)).toMatch(/au moins une action/i);
  });

  it('ignores empty lines and numbers exported actions within each phrase', () => {
    const firstPhrase = { id: 'phrase-1', end: 2.5, lines: [
      line(),
      line({ id: 'empty', attacker: '', handMovement: '', footMovement: '', details: '', defender: '' }),
      line({ id: 'two', attacker: 'B', handMovement: 'Riposte', footMovement: 'Marche', details: 'en avançant', defender: 'A', defenderMovement: 'Esquive', defenderDetails: 'sur le côté' }),
    ] };
    const emptyPhrase = { id: 'phrase-2', end: 3, lines: [] };
    const thirdPhrase = { id: 'phrase-3', end: 4, lines: [line({ id: 'three', attacker: 'C' })] };
    expect(formatProject({ ...defaultDraft(), fighters: [], phrases: [firstPhrase, emptyPhrase, thirdPhrase] })).toBe(
      '0.0 - Début Phrase 1\n1.1 - Combattant A Parade\n1.2 - B Riposte Marche en avançant contre A qui Esquive sur le côté\n2.5 - Fin Phrase 1\n\n3.0 - Début Phrase 3\n3.1 - C Parade\n4.0 - Fin Phrase 3',
    );
  });

  it('exports reaction movement or detail only when a defender is present', () => {
    expect(formatProject(draftWithLines([line({ defender: 'B', defenderDetails: 'se protège' })]))).toBe('0.0 - Début Phrase 1\n1.1 - Combattant A Parade contre B qui se protège\n0.0 - Fin Phrase 1');
    expect(formatProject(draftWithLines([line({ defender: 'B', defenderMovement: 'Parade' })]))).toContain('1.1 - Combattant A Parade contre B qui Parade');
    expect(formatProject(draftWithLines([line({ defender: '', defenderMovement: 'Parade', defenderDetails: 'se protège' })]))).toContain('1.1 - Combattant A Parade');
  });

  it('keeps project metadata and participant records out of the current text export', () => {
    const draft = draftWithLines([line()]);
    draft.info.title = 'Le duel';
    draft.info.club = 'Club SL';
    draft.info.notes = 'Intrigue et musique';
    draft.assistants.push({ id: 'assistant-1', firstName: 'Sam', lastName: 'Lee', licenseNumber: '00123', role: 'Figurant' });
    expect(formatProject(draft)).toBe('0.0 - Début Phrase 1\n1.1 - Combattant A Parade\n0.0 - Fin Phrase 1');
  });

  it('requires an attacker and at least one movement on each started line', () => {
    expect(getExportError(draftWithLines([line(), line({ id: 'empty', attacker: '', handMovement: '', footMovement: '', details: '', defender: '' })]))).toBeNull();
    expect(getExportError(draftWithLines([line({ attacker: '', details: 'en reculant' })]))).toMatch(/attaquant/i);
    expect(getExportError(draftWithLines([line({ handMovement: '', details: 'en reculant' })]))).toMatch(/mouvement de main ou de pieds/i);
    expect(getExportError(draftWithLines([line({ id: 'empty', attacker: '', handMovement: '', footMovement: '', details: '', defender: '' }), line({ id: 'second', handMovement: '', footMovement: '' })]))).toMatch(/ligne 1\.2/i);
    expect(getExportError(draftWithLines([line({ handMovement: '', footMovement: 'Retraite' })]))).toBeNull();
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

  it('normalizes multiline project notes while preserving line breaks', () => {
    expect(normalizeMultiLine('Intrigue\r\nMusique\u0000', 5000)).toBe('Intrigue\nMusique');
    expect(normalizeMultiLine('x'.repeat(5100), 5000)).toHaveLength(5000);
  });

  it('calculates opposition time from started phrases and skips empty phrases', () => {
    const draft = defaultDraft();
    draft.phrases = [
      { id: 'first', end: 10, lines: [line()] },
      { id: 'empty', end: 15, lines: [] },
      { id: 'last', end: 20.5555, lines: [line({ id: 'last-line' })] },
    ];
    expect(calculateOppositionDuration(draft)).toBe('00m:15.556s');
    draft.phrases = [{ id: 'empty', end: 2, lines: [line({ attacker: '', handMovement: '', details: '' })] }];
    expect(calculateOppositionDuration(draft)).toBe('00m:00s');
  });

  it('rejects malformed or oversized persisted drafts', () => {
    expect(isProjectDraft({ fighters: [], phrases: [{ id: 'phrase-1', end: 0, lines: [{ ...line(), attacker: 'x\ny' }] }] })).toBe(false);
    expect(isProjectDraft({ fighters: [], phrases: [] })).toBe(false);
    expect(isProjectDraft({ fighters: [], phrases: [{ id: 'phrase-1', end: 1, lines: [] }, { id: 'phrase-2', end: 0, lines: [] }] })).toBe(false);
    expect(isProjectDraft({ fighters: Array(51).fill('x'), lines: [] })).toBe(false);
  });

  it('recovers from malformed or inaccessible local storage', () => {
    const malformed = loadDraft({ getItem: (key) => key === STORAGE_KEY ? '{not json' : null, setItem: () => undefined, removeItem: () => undefined });
    expect(malformed.warning).toMatch(/invalide|illisible/i);
    expect(malformed.draft.fighters.map(({ name }) => name)).toEqual(['Combattant A', 'Combattant B']);

    const denied = loadDraft({ getItem: () => { throw new Error('denied'); }, setItem: () => undefined, removeItem: () => undefined });
    expect(denied.warning).toMatch(/stockage local/i);
  });

  it('reads a valid saved draft from the expected storage key', () => {
    const base = defaultDraft();
    const saved = { ...base, fighters: [{ ...base.fighters[0], name: 'A' }], phrases: [{ id: 'phrase-1', end: 0, lines: [line()] }] };
    const loaded = loadDraft({ getItem: (key) => key === STORAGE_KEY ? JSON.stringify(saved) : null, setItem: () => undefined, removeItem: () => undefined });
    expect(loaded.draft).toEqual(saved);
    expect(loaded.warning).toBeNull();
  });

  it('migrates known legacy movements by category and keeps unknown actions in the hand field', () => {
    const categories = new Map<string, MovementCategory>([
      ['marche', 'pieds'],
      ['parade', 'main'],
      ['supernova', 'combine'],
    ]);
    const legacy = {
      fighters: ['A', 'B'],
      lines: [
        { id: 'known-foot', attacker: 'A', action: 'Marche', details: '', defender: 'B' },
        { id: 'known-hand', attacker: 'B', action: 'Parade', details: '', defender: 'A' },
        { id: 'known-combine', attacker: 'A', action: 'Supernova', details: '', defender: 'B' },
        { id: 'free', attacker: 'A', action: 'Mouvement libre', details: '', defender: '' },
      ],
    };
    const migrated = migrateLegacyDraft(legacy, categories);
    expect(migrated.phrases).toHaveLength(1);
    expect(migrated.phrases[0].lines[0]).toMatchObject({ handMovement: '', footMovement: 'Marche' });
    expect(migrated.phrases[0].lines[1]).toMatchObject({ handMovement: 'Parade', footMovement: '' });
    expect(migrated.phrases[0].lines[2]).toMatchObject({ handMovement: 'Supernova', footMovement: '' });
    expect(migrated.phrases[0].lines[3]).toMatchObject({ handMovement: 'Mouvement libre', footMovement: '' });
  });

  it('persists the migrated draft under v5 before removing the v1 key', () => {
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
    expect(loaded.draft.phrases[0].lines[0].footMovement).toBe('Marche');
    expect(values.has(STORAGE_KEY)).toBe(true);
    expect(values.has(LEGACY_STORAGE_KEY)).toBe(false);
  });

  it('migrates v2 drafts by adding empty defender reaction fields', () => {
    const values = new Map([[OLDER_STORAGE_KEY, JSON.stringify({
      fighters: ['A', 'B'],
      lines: [{ id: 'prior', attacker: 'A', handMovement: 'Parade', footMovement: '', details: '', defender: 'B' }],
    })]]);
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
      removeItem: (key: string) => { values.delete(key); },
    };
    const loaded = loadDraft(storage);
    expect(loaded.draft.phrases[0].lines[0]).toMatchObject({ defender: 'B', defenderMovement: '', defenderDetails: '' });
    expect(values.has(STORAGE_KEY)).toBe(true);
    expect(values.has(OLDER_STORAGE_KEY)).toBe(false);
  });

  it('migrates v3 lines into the first parent phrase', () => {
    const values = new Map([[PREVIOUS_STORAGE_KEY, JSON.stringify({ fighters: ['A'], lines: [line()] })]]);
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
      removeItem: (key: string) => { values.delete(key); },
    };
    const loaded = loadDraft(storage);
    expect(loaded.migrated).toBe(true);
    expect(loaded.draft.phrases).toHaveLength(1);
    expect(loaded.draft.phrases[0].lines).toHaveLength(1);
    expect(values.has(STORAGE_KEY)).toBe(true);
    expect(values.has(PREVIOUS_STORAGE_KEY)).toBe(false);
  });

  it('migrates v4 project fields and phrase timings without changing action names', () => {
    const oldDraft = { fighters: ['Combattant A'], phrases: [{ id: 'phrase-v4', end: 8.5, lines: [line({ id: 'line-v4' })] }] };
    const values = new Map([[V4_STORAGE_KEY, JSON.stringify(oldDraft)]]);
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
      removeItem: (key: string) => { values.delete(key); },
    };
    const loaded = loadDraft(storage);
    expect(loaded.draft.fighters[0]).toMatchObject({ name: 'Combattant A', firstName: '', lastName: '' });
    expect(loaded.draft.phrases).toEqual(oldDraft.phrases);
    expect(loaded.draft.info.oppositionDuration).toBe('00m:00s');
    expect(values.has(STORAGE_KEY)).toBe(true);
    expect(values.has(V4_STORAGE_KEY)).toBe(false);
  });

  it('keeps the old draft when migration cannot be written', () => {
    const values = new Map([[V4_STORAGE_KEY, JSON.stringify({ fighters: ['A'], phrases: [{ id: 'p', end: 0, lines: [] }] })]]);
    const loaded = loadDraft({
      getItem: (key) => values.get(key) ?? null,
      setItem: () => { throw new Error('quota'); },
      removeItem: (key) => { values.delete(key); },
    });
    expect(loaded.warning).toMatch(/n’a pas pu être enregistré/i);
    expect(values.has(V4_STORAGE_KEY)).toBe(true);
  });
});
