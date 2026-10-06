import { describe, expect, it } from 'vitest';
import {
  calculateOppositionDuration,
  createProjectFile,
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
  parseProjectFile,
  OLDER_STORAGE_KEY,
  PREVIOUS_STORAGE_KEY,
  STORAGE_KEY,
  V4_STORAGE_KEY,
  V5_STORAGE_KEY,
  type ChoreographyLine,
  type ProjectDraft,
  type MovementCategory,
} from './project';

const line = (fields: Partial<ChoreographyLine> = {}): ChoreographyLine => ({
  id: 'line-1', attacker: 'Combattant A', handMovement: 'Parade', footMovement: '', details: '', defender: '', defenderMovement: '', defenderDetails: '', ...fields,
});
const phrases = (draft: ProjectDraft) => draft.sections.filter((section) => section.type === 'phrase');
const draftWithLines = (lines: ChoreographyLine[]) => {
  const draft = defaultDraft();
  const first = draft.sections[0];
  if (first.type !== 'phrase') throw new Error('Default phrase missing');
  return { ...draft, sections: [{ ...first, lines }] };
};

describe('project formatting and validation', () => {
  it('starts with the two default fighters and one empty line', () => {
    const draft = defaultDraft();
    expect(draft.fighters.map(({ name }) => name)).toEqual(['Combattant A', 'Combattant B']);
    expect(phrases(draft)).toHaveLength(1);
    expect(phrases(draft)[0].lines).toHaveLength(1);
    expect(getExportError(draft)).toMatch(/au moins une action/i);
  });

  it('round trips incomplete JSON projects as data while rejecting unknown structure and versions', () => {
    const draft = defaultDraft();
    draft.fighters[0].name = '<img src=x onerror=alert(1)>';
    const json = JSON.stringify(createProjectFile(draft));
    expect(parseProjectFile(json)).toEqual(draft);

    const withUnknownField = JSON.parse(json);
    withUnknownField.project.instructions = 'execute this';
    expect(parseProjectFile(JSON.stringify(withUnknownField))).toBeNull();

    const unknownVersion = JSON.parse(json);
    unknownVersion.version = 3;
    expect(parseProjectFile(JSON.stringify(unknownVersion))).toBeNull();
    expect(parseProjectFile(`${json}${' '.repeat(10 * 1024 * 1024)}`)).toBeNull();
  });

  it('migrates version 1 JSON and rejects lines attached to choreographic times', () => {
    const draft = defaultDraft();
    const oldFile = createProjectFile(draft) as unknown as { format: string; version: number; project: Record<string, unknown> };
    const { sections, ...project } = oldFile.project as ProjectDraft & { sections: ProjectDraft['sections'] };
    oldFile.version = 1;
    oldFile.project = { ...project, phrases: sections.map(({ type: _type, ...phrase }) => phrase) };
    const migrated = parseProjectFile(JSON.stringify(oldFile));
    expect(migrated?.sections[0]).toMatchObject({ type: 'phrase', id: draft.sections[0].id });

    const invalid = createProjectFile({ ...draft, sections: [...draft.sections, { type: 'temps', id: 'time', end: 1 }] });
    const tampered = JSON.parse(JSON.stringify(invalid));
    tampered.project.sections[1].lines = [];
    expect(parseProjectFile(JSON.stringify(tampered))).toBeNull();
  });

  it('ignores empty lines and numbers exported actions within each phrase', () => {
    const firstPhrase = { type: 'phrase' as const, id: 'phrase-1', end: 2.5, lines: [
      line(),
      line({ id: 'empty', attacker: '', handMovement: '', footMovement: '', details: '', defender: '' }),
      line({ id: 'two', attacker: 'B', handMovement: 'Riposte', footMovement: 'Marche', details: 'en avançant', defender: 'A', defenderMovement: 'Esquive', defenderDetails: 'sur le côté' }),
    ] };
    const emptyPhrase = { type: 'phrase' as const, id: 'phrase-2', end: 3, lines: [] };
    const thirdPhrase = { type: 'phrase' as const, id: 'phrase-3', end: 4, lines: [line({ id: 'three', attacker: 'C' })] };
    expect(formatProject({ ...defaultDraft(), fighters: [], sections: [firstPhrase, emptyPhrase, thirdPhrase] })).toBe(
      '0.0 - Début Phrase 1\n1.1 - Combattant A Parade\n1.2 - B Riposte Marche en avançant contre A qui Esquive sur le côté\n2.5 - Fin Phrase 1\n\n3.0 - Début Phrase 3\n3.1 - C Parade\n4.0 - Fin Phrase 3',
    );
  });

  it('serializes choreographic times in sequence and excludes them from opposition duration', () => {
    const draft = defaultDraft();
    const phrase = draft.sections[0];
    if (phrase.type !== 'phrase') throw new Error('Default phrase missing');
    draft.sections = [
      { ...phrase, end: 10, lines: [line()] },
      { type: 'temps', id: 'time-1', end: 15 },
      { type: 'phrase', id: 'phrase-2', end: 20, lines: [line({ id: 'line-2' })] },
    ];
    expect(calculateOppositionDuration(draft)).toBe('00m:15s');
    expect(formatProject(draft)).toContain('10.0 - Début Temps chorégraphique 1\n15.0 - Fin Temps chorégraphique 1');
    expect(formatProject(draft)).toContain('15.0 - Début Phrase 2\n2.1 - Combattant A Parade');
  });

  it('allows exporting a project containing only a choreographic time', () => {
    const draft = defaultDraft();
    draft.sections = [{ type: 'phrase', id: 'p', end: 0, lines: [] }, { type: 'temps', id: 't', end: 3 }];
    expect(getExportError(draft)).toBeNull();
    expect(formatProject(draft)).toContain('0.0 - Début Temps chorégraphique 1');
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
    draft.sections = [
      { type: 'phrase', id: 'first', end: 10, lines: [line()] },
      { type: 'phrase', id: 'empty', end: 15, lines: [] },
      { type: 'phrase', id: 'last', end: 20.5555, lines: [line({ id: 'last-line' })] },
    ];
    expect(calculateOppositionDuration(draft)).toBe('00m:15.556s');
    draft.sections = [{ type: 'phrase', id: 'empty', end: 2, lines: [line({ attacker: '', handMovement: '', details: '' })] }];
    expect(calculateOppositionDuration(draft)).toBe('00m:00s');
  });

  it('rejects malformed or oversized persisted drafts', () => {
    expect(isProjectDraft({ ...defaultDraft(), sections: [{ type: 'phrase', id: 'phrase-1', end: 0, lines: [{ ...line(), attacker: 'x\ny' }] }] })).toBe(false);
    expect(isProjectDraft({ ...defaultDraft(), sections: [] })).toBe(false);
    expect(isProjectDraft({ ...defaultDraft(), sections: [{ type: 'phrase', id: 'phrase-1', end: 1, lines: [] }, { type: 'phrase', id: 'phrase-2', end: 0, lines: [] }] })).toBe(false);
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
    const saved = { ...base, fighters: [{ ...base.fighters[0], name: 'A' }], sections: [{ type: 'phrase' as const, id: 'phrase-1', end: 0, lines: [line()] }] };
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
    expect(phrases(migrated)).toHaveLength(1);
    expect(phrases(migrated)[0].lines[0]).toMatchObject({ handMovement: '', footMovement: 'Marche' });
    expect(phrases(migrated)[0].lines[1]).toMatchObject({ handMovement: 'Parade', footMovement: '' });
    expect(phrases(migrated)[0].lines[2]).toMatchObject({ handMovement: 'Supernova', footMovement: '' });
    expect(phrases(migrated)[0].lines[3]).toMatchObject({ handMovement: 'Mouvement libre', footMovement: '' });
  });

  it('persists the migrated draft under v6 before removing the v1 key', () => {
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
    expect(phrases(loaded.draft)[0].lines[0].footMovement).toBe('Marche');
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
    expect(phrases(loaded.draft)[0].lines[0]).toMatchObject({ defender: 'B', defenderMovement: '', defenderDetails: '' });
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
    expect(phrases(loaded.draft)).toHaveLength(1);
    expect(phrases(loaded.draft)[0].lines).toHaveLength(1);
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
    expect(phrases(loaded.draft)).toEqual(oldDraft.phrases.map((phrase) => ({ type: 'phrase', ...phrase })));
    expect(loaded.draft.info.oppositionDuration).toBe('00m:00s');
    expect(values.has(STORAGE_KEY)).toBe(true);
    expect(values.has(V4_STORAGE_KEY)).toBe(false);
  });

  it('migrates the complete v5 draft to ordered phrase sections', () => {
    const previous = defaultDraft();
    const phrase = previous.sections[0];
    if (phrase.type !== 'phrase') throw new Error('Default phrase missing');
    const values = new Map([[V5_STORAGE_KEY, JSON.stringify({ ...previous, sections: undefined, phrases: [{ id: phrase.id, end: 7, lines: phrase.lines }] })]]);
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
      removeItem: (key: string) => { values.delete(key); },
    };
    const loaded = loadDraft(storage);
    expect(loaded.migrated).toBe(true);
    expect(loaded.draft.sections).toEqual([{ type: 'phrase', id: phrase.id, end: 7, lines: phrase.lines }]);
    expect(values.has(V5_STORAGE_KEY)).toBe(false);
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
