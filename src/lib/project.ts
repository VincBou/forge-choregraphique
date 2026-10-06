export const STORAGE_KEY = 'forgechoree.project.v6';
export const V5_STORAGE_KEY = 'forgechoree.project.v5';
export const PREVIOUS_STORAGE_KEY = 'forgechoree.project.v3';
export const OLDER_STORAGE_KEY = 'forgechoree.project.v2';
export const LEGACY_STORAGE_KEY = 'forgechoree.project.v1';
export const V4_STORAGE_KEY = 'forgechoree.project.v4';
export const MAX_NAME_LENGTH = 100;
export const MAX_DETAILS_LENGTH = 500;
export const MAX_PROJECT_INFO_LENGTH = 5000;
export const MAX_DURATION_LENGTH = 30;
export const MAX_FIGHTERS = 50;
export const MAX_ASSISTANTS = 50;
export const MAX_LINES = 500;
export const MAX_PROJECT_FILE_BYTES = 10 * 1024 * 1024;

export type MovementCategory = 'main' | 'pieds' | 'combine';

export type Fighter = {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  licenseNumber: string;
  captain: boolean;
};

export type Assistant = {
  id: string;
  firstName: string;
  lastName: string;
  licenseNumber: string;
  role: string;
};

export type ProjectInfo = {
  title: string;
  club: string;
  duration: string;
  oppositionDuration: string;
  notes: string;
  ensemble: boolean;
};

export type ChoreographyLine = {
  id: string;
  attacker: string;
  handMovement: string;
  footMovement: string;
  details: string;
  defender: string;
  defenderMovement: string;
  defenderDetails: string;
};

export type PhraseDArmes = {
  type: 'phrase';
  id: string;
  end: number;
  lines: ChoreographyLine[];
};

export type TempsChoregraphique = { type: 'temps'; id: string; end: number };
export type ChoreographySection = PhraseDArmes | TempsChoregraphique;

export type ProjectDraft = {
  info: ProjectInfo;
  fighters: Fighter[];
  assistants: Assistant[];
  sections: ChoreographySection[];
};

export type ProjectFile = {
  format: 'forge-choregraphique';
  version: 2;
  project: ProjectDraft;
};

type LegacyLine = { id: string; attacker: string; action: string; details: string; defender: string };
type LegacyPhrase = Omit<PhraseDArmes, 'type'>;
type V5Draft = { info: ProjectInfo; fighters: Fighter[]; assistants: Assistant[]; phrases: LegacyPhrase[] };
type V2Line = Omit<ChoreographyLine, 'defenderMovement' | 'defenderDetails'>;
type V3Draft = { fighters: string[]; lines: ChoreographyLine[] };
type V2Draft = { fighters: string[]; lines: V2Line[] };
type LegacyDraft = { fighters: string[]; lines: LegacyLine[] };
type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export const createLineId = (): string => typeof crypto !== 'undefined' && 'randomUUID' in crypto
  ? crypto.randomUUID()
  : `line-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const createFighter = (name: string): Fighter => ({ id: createLineId(), name, firstName: '', lastName: '', licenseNumber: '', captain: false });
const createEmptyProjectInfo = (): ProjectInfo => ({ title: '', club: '', duration: '00m:00s', oppositionDuration: '00m:00s', notes: '', ensemble: false });
const createEmptyLine = (): ChoreographyLine => ({ id: createLineId(), attacker: '', handMovement: '', footMovement: '', details: '', defender: '', defenderMovement: '', defenderDetails: '' });

export const defaultDraft = (): ProjectDraft => ({
  info: createEmptyProjectInfo(),
  fighters: [createFighter('Combattant A'), createFighter('Combattant B')],
  assistants: [],
  sections: [{ type: 'phrase', id: createLineId(), end: 0, lines: [createEmptyLine()] }],
});

export function normalizeSingleLine(value: string, maxLength: number): string {
  return value.normalize('NFC').replace(/[\r\n\u0000-\u001f\u007f]/g, '').slice(0, maxLength);
}

export function normalizeMultiLine(value: string, maxLength: number): string {
  return value.normalize('NFC').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '').slice(0, maxLength);
}

export function normalizeSearch(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr');
}

function isValidText(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.length <= maxLength && !/[\r\n\u0000-\u001f\u007f]/.test(value);
}

function isValidMultiline(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.length <= maxLength && !/[\r\u0000-\u0009\u000b-\u001f\u007f]/.test(value);
}

function isValidId(value: unknown, ids: Set<string>): value is string {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(value) || ids.has(value)) return false;
  ids.add(value);
  return true;
}

function isValidLegacyFighters(value: unknown): value is string[] {
  return Array.isArray(value) && value.length <= MAX_FIGHTERS && value.every((name) => isValidText(name, MAX_NAME_LENGTH));
}

function isValidFighter(value: unknown, ids: Set<string>): value is Fighter {
  if (!value || typeof value !== 'object') return false;
  const fighter = value as Fighter;
  return isValidId(fighter.id, ids)
    && isValidText(fighter.name, MAX_NAME_LENGTH)
    && isValidText(fighter.firstName, MAX_NAME_LENGTH)
    && isValidText(fighter.lastName, MAX_NAME_LENGTH)
    && isValidText(fighter.licenseNumber, MAX_NAME_LENGTH)
    && typeof fighter.captain === 'boolean';
}

function isValidAssistant(value: unknown, ids: Set<string>): value is Assistant {
  if (!value || typeof value !== 'object') return false;
  const assistant = value as Assistant;
  return isValidId(assistant.id, ids)
    && isValidText(assistant.firstName, MAX_NAME_LENGTH)
    && isValidText(assistant.lastName, MAX_NAME_LENGTH)
    && isValidText(assistant.licenseNumber, MAX_NAME_LENGTH)
    && isValidText(assistant.role, MAX_NAME_LENGTH);
}

function isValidInfo(value: unknown): value is ProjectInfo {
  if (!value || typeof value !== 'object') return false;
  const info = value as ProjectInfo;
  return isValidText(info.title, MAX_NAME_LENGTH)
    && isValidText(info.club, MAX_NAME_LENGTH)
    && isValidText(info.duration, MAX_DURATION_LENGTH)
    && isValidText(info.oppositionDuration, MAX_DURATION_LENGTH)
    && isValidMultiline(info.notes, MAX_PROJECT_INFO_LENGTH)
    && typeof info.ensemble === 'boolean';
}

function isValidChoreographyLine(value: unknown, ids: Set<string>): value is ChoreographyLine {
  if (!value || typeof value !== 'object') return false;
  const line = value as ChoreographyLine;
  return isValidId(line.id, ids)
    && isValidText(line.attacker, MAX_NAME_LENGTH)
    && isValidText(line.handMovement, MAX_NAME_LENGTH)
    && isValidText(line.footMovement, MAX_NAME_LENGTH)
    && isValidText(line.defender, MAX_NAME_LENGTH)
    && isValidText(line.details, MAX_DETAILS_LENGTH)
    && isValidText(line.defenderMovement, MAX_NAME_LENGTH)
    && isValidText(line.defenderDetails, MAX_DETAILS_LENGTH);
}

function isValidLegacyPhrase(value: unknown, ids: Set<string>, lineCount: { value: number }, previousEnd: { value: number }): value is LegacyPhrase {
  if (!value || typeof value !== 'object') return false;
  const phrase = value as LegacyPhrase;
  if (!isValidId(phrase.id, ids) || typeof phrase.end !== 'number' || !Number.isFinite(phrase.end)
    || phrase.end < previousEnd.value || !Array.isArray(phrase.lines)) return false;
  previousEnd.value = phrase.end;
  lineCount.value += phrase.lines.length;
  return lineCount.value <= MAX_LINES && phrase.lines.every((line) => isValidChoreographyLine(line, ids));
}

function isValidSection(value: unknown, ids: Set<string>, lineCount: { value: number }, previousEnd: { value: number }): value is ChoreographySection {
  if (!value || typeof value !== 'object') return false;
  const section = value as ChoreographySection;
  if (typeof section.end !== 'number' || !Number.isFinite(section.end) || section.end < previousEnd.value || !isValidId(section.id, ids)) return false;
  previousEnd.value = section.end;
  if (section.type === 'temps') return true;
  if (section.type !== 'phrase' || !Array.isArray(section.lines)) return false;
  lineCount.value += section.lines.length;
  return lineCount.value <= MAX_LINES && section.lines.every((line) => isValidChoreographyLine(line, ids));
}

export function isProjectDraft(value: unknown): value is ProjectDraft {
  if (!value || typeof value !== 'object') return false;
  const draft = value as ProjectDraft;
  if (!isValidInfo(draft.info) || !Array.isArray(draft.fighters) || draft.fighters.length > MAX_FIGHTERS
    || !Array.isArray(draft.assistants) || draft.assistants.length > MAX_ASSISTANTS
    || !Array.isArray(draft.sections) || draft.sections.length === 0) return false;
  const ids = new Set<string>();
  if (!draft.fighters.every((fighter) => isValidFighter(fighter, ids))
    || !draft.assistants.every((assistant) => isValidAssistant(assistant, ids))) return false;
  const lineCount = { value: 0 };
  const previousEnd = { value: 0 };
  let phraseCount = 0;
  return draft.sections.every((section) => {
    if ((section as ChoreographySection)?.type === 'phrase') phraseCount += 1;
    return isValidSection(section, ids, lineCount, previousEnd);
  }) && phraseCount > 0;
}

function hasExactKeys(value: unknown, keys: string[]): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function sanitizeProjectDraft(value: unknown, rejectUnknown = true): ProjectDraft | null {
  if (!isProjectDraft(value)) return null;
  const draft = value;
  const exactShape = hasExactKeys(draft, ['info', 'fighters', 'assistants', 'sections'])
    && hasExactKeys(draft.info, ['title', 'club', 'duration', 'oppositionDuration', 'notes', 'ensemble'])
    && draft.fighters.every((fighter) => hasExactKeys(fighter, ['id', 'name', 'firstName', 'lastName', 'licenseNumber', 'captain']))
    && draft.assistants.every((assistant) => hasExactKeys(assistant, ['id', 'firstName', 'lastName', 'licenseNumber', 'role']))
    && draft.sections.every((section) => section.type === 'phrase'
      ? hasExactKeys(section, ['type', 'id', 'end', 'lines'])
        && section.lines.every((line) => hasExactKeys(line, ['id', 'attacker', 'handMovement', 'footMovement', 'details', 'defender', 'defenderMovement', 'defenderDetails']))
      : hasExactKeys(section, ['type', 'id', 'end']) && section.type === 'temps');
  if (rejectUnknown && !exactShape) return null;

  return {
    info: { title: draft.info.title, club: draft.info.club, duration: draft.info.duration, oppositionDuration: draft.info.oppositionDuration, notes: draft.info.notes, ensemble: draft.info.ensemble },
    fighters: draft.fighters.map(({ id, name, firstName, lastName, licenseNumber, captain }) => ({ id, name, firstName, lastName, licenseNumber, captain })),
    assistants: draft.assistants.map(({ id, firstName, lastName, licenseNumber, role }) => ({ id, firstName, lastName, licenseNumber, role })),
    sections: draft.sections.map((section) => section.type === 'temps'
      ? { type: 'temps', id: section.id, end: section.end }
      : { type: 'phrase', id: section.id, end: section.end, lines: section.lines.map(({ id, attacker, handMovement, footMovement, details, defender, defenderMovement, defenderDetails }) => ({
        id, attacker, handMovement, footMovement, details, defender, defenderMovement, defenderDetails,
      })) }),
  };
}

function sanitizeV5Draft(value: unknown): V5Draft | null {
  if (!value || typeof value !== 'object') return null;
  const draft = value as V5Draft;
  if (!isValidInfo(draft.info) || !Array.isArray(draft.fighters) || draft.fighters.length > MAX_FIGHTERS
    || !Array.isArray(draft.assistants) || draft.assistants.length > MAX_ASSISTANTS
    || !Array.isArray(draft.phrases) || draft.phrases.length === 0) return null;
  const ids = new Set<string>();
  const lineCount = { value: 0 };
  const previousEnd = { value: 0 };
  if (!draft.fighters.every((fighter) => isValidFighter(fighter, ids))
    || !draft.assistants.every((assistant) => isValidAssistant(assistant, ids))
    || !draft.phrases.every((phrase) => isValidLegacyPhrase(phrase, ids, lineCount, previousEnd))) return null;
  const exact = hasExactKeys(draft, ['info', 'fighters', 'assistants', 'phrases'])
    && hasExactKeys(draft.info, ['title', 'club', 'duration', 'oppositionDuration', 'notes', 'ensemble'])
    && draft.fighters.every((fighter) => hasExactKeys(fighter, ['id', 'name', 'firstName', 'lastName', 'licenseNumber', 'captain']))
    && draft.assistants.every((assistant) => hasExactKeys(assistant, ['id', 'firstName', 'lastName', 'licenseNumber', 'role']))
    && draft.phrases.every((phrase) => hasExactKeys(phrase, ['id', 'end', 'lines'])
      && phrase.lines.every((line) => hasExactKeys(line, ['id', 'attacker', 'handMovement', 'footMovement', 'details', 'defender', 'defenderMovement', 'defenderDetails'])));
  return exact ? draft : null;
}

export function createProjectFile(project: ProjectDraft): ProjectFile {
  const safeProject = sanitizeProjectDraft(project, false);
  if (!safeProject) throw new TypeError('Invalid project draft');
  return { format: 'forge-choregraphique', version: 2, project: safeProject };
}

export function parseProjectFile(json: string): ProjectDraft | null {
  if (new TextEncoder().encode(json).byteLength > MAX_PROJECT_FILE_BYTES) return null;
  try {
    const value: unknown = JSON.parse(json.charCodeAt(0) === 0xfeff ? json.slice(1) : json);
    if (!hasExactKeys(value, ['format', 'version', 'project'])
      || value.format !== 'forge-choregraphique' || ![1, 2].includes(value.version as number)) return null;
    if (value.version === 2) return sanitizeProjectDraft(value.project);
    const legacy = sanitizeV5Draft(value.project);
    return legacy ? migrateV5(legacy) : null;
  } catch {
    return null;
  }
}

function isV4Draft(value: unknown): value is { fighters: string[]; phrases: LegacyPhrase[] } {
  if (!value || typeof value !== 'object') return false;
  const draft = value as { fighters: unknown; phrases: unknown };
  if (!isValidLegacyFighters(draft.fighters) || !Array.isArray(draft.phrases) || draft.phrases.length === 0) return false;
  const ids = new Set<string>();
  const lineCount = { value: 0 };
  const previousEnd = { value: 0 };
  return draft.phrases.every((phrase) => isValidLegacyPhrase(phrase, ids, lineCount, previousEnd));
}

function isV3Draft(value: unknown): value is V3Draft {
  if (!value || typeof value !== 'object') return false;
  const draft = value as { fighters: unknown; lines: unknown };
  if (!isValidLegacyFighters(draft.fighters) || !Array.isArray(draft.lines) || draft.lines.length > MAX_LINES) return false;
  const ids = new Set<string>();
  return draft.lines.every((line) => isValidChoreographyLine(line, ids));
}

function isV2Draft(value: unknown): value is V2Draft {
  if (!value || typeof value !== 'object') return false;
  const draft = value as { fighters: unknown; lines: unknown };
  if (!isValidLegacyFighters(draft.fighters) || !Array.isArray(draft.lines) || draft.lines.length > MAX_LINES) return false;
  const ids = new Set<string>();
  return draft.lines.every((value) => {
    if (!value || typeof value !== 'object') return false;
    const line = value as V2Line;
    return isValidId(line.id, ids) && isValidText(line.attacker, MAX_NAME_LENGTH)
      && isValidText(line.handMovement, MAX_NAME_LENGTH) && isValidText(line.footMovement, MAX_NAME_LENGTH)
      && isValidText(line.defender, MAX_NAME_LENGTH) && isValidText(line.details, MAX_DETAILS_LENGTH);
  });
}

function isLegacyDraft(value: unknown): value is LegacyDraft {
  if (!value || typeof value !== 'object') return false;
  const draft = value as { fighters: unknown; lines: unknown };
  if (!isValidLegacyFighters(draft.fighters) || !Array.isArray(draft.lines) || draft.lines.length > MAX_LINES) return false;
  const ids = new Set<string>();
  return draft.lines.every((value) => {
    if (!value || typeof value !== 'object') return false;
    const line = value as LegacyLine;
    return isValidId(line.id, ids) && isValidText(line.attacker, MAX_NAME_LENGTH)
      && isValidText(line.action, MAX_NAME_LENGTH) && isValidText(line.defender, MAX_NAME_LENGTH)
      && isValidText(line.details, MAX_DETAILS_LENGTH);
  });
}

function wrapLinesInFirstPhrase(fighters: string[], lines: ChoreographyLine[]): ProjectDraft {
  return { ...defaultDraft(), fighters: fighters.map(createFighter), sections: [{ type: 'phrase', id: createLineId(), end: 0, lines: lines.map((line) => ({ ...line })) }] };
}

export function migrateLegacyDraft(legacy: LegacyDraft, movementCategories: ReadonlyMap<string, MovementCategory>): ProjectDraft {
  const lines = legacy.lines.map(({ action, ...line }) => {
    const category = movementCategories.get(normalizeSearch(action.trim())) ?? 'main';
    return { ...line, handMovement: category === 'pieds' ? '' : action, footMovement: category === 'pieds' ? action : '', defenderMovement: '', defenderDetails: '' };
  });
  return wrapLinesInFirstPhrase(legacy.fighters, lines);
}

function migrateV2(draft: V2Draft): ProjectDraft {
  return wrapLinesInFirstPhrase(draft.fighters, draft.lines.map((line) => ({ ...line, defenderMovement: '', defenderDetails: '' })));
}

function migrateV3(draft: V3Draft): ProjectDraft {
  return wrapLinesInFirstPhrase(draft.fighters, draft.lines);
}

function migrateV4(draft: { fighters: string[]; phrases: LegacyPhrase[] }): ProjectDraft {
  const migrated = defaultDraft();
  return {
    ...migrated,
    fighters: draft.fighters.map(createFighter),
    sections: draft.phrases.map((phrase) => ({ type: 'phrase', ...phrase, lines: phrase.lines.map((line) => ({ ...line })) })),
  };
}

function migrateV5(draft: V5Draft): ProjectDraft {
  return { info: draft.info, fighters: draft.fighters, assistants: draft.assistants,
    sections: draft.phrases.map((phrase) => ({ type: 'phrase', ...phrase })) };
}

function isV5Draft(value: unknown): value is V5Draft {
  return sanitizeV5Draft(value) !== null;
}

export type LoadedDraft = { draft: ProjectDraft; warning: string | null; migrated: boolean };

function saveMigratedDraft(target: DraftStorage, oldKey: string, draft: ProjectDraft): LoadedDraft {
  try {
    target.setItem(STORAGE_KEY, JSON.stringify(draft));
    target.removeItem(oldKey);
    return { draft, warning: null, migrated: true };
  } catch {
    return { draft, warning: 'Le brouillon a été converti, mais n’a pas pu être enregistré dans le stockage local.', migrated: true };
  }
}

export function loadDraft(storage?: DraftStorage, movementCategories: ReadonlyMap<string, MovementCategory> = new Map()): LoadedDraft {
  try {
    const target = storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
    if (!target) return { draft: defaultDraft(), warning: 'Le stockage local est indisponible. Le brouillon ne sera pas conservé après fermeture.', migrated: false };

    const currentRaw = target.getItem(STORAGE_KEY);
    let currentInvalid = false;
    if (currentRaw !== null) {
      try {
        const current: unknown = JSON.parse(currentRaw);
        if (isProjectDraft(current)) return { draft: current, warning: null, migrated: false };
        currentInvalid = true;
      } catch { currentInvalid = true; }
    }

    const v5Raw = target.getItem(V5_STORAGE_KEY);
    if (v5Raw !== null) {
      try {
        const v5: unknown = JSON.parse(v5Raw);
        if (isV5Draft(v5)) return saveMigratedDraft(target, V5_STORAGE_KEY, migrateV5(v5));
      } catch { /* Try older draft formats. */ }
    }

    const v4Raw = target.getItem(V4_STORAGE_KEY);
    if (v4Raw !== null) {
      try {
        const v4: unknown = JSON.parse(v4Raw);
        if (isV4Draft(v4)) return saveMigratedDraft(target, V4_STORAGE_KEY, migrateV4(v4));
      } catch { /* Try older draft formats. */ }
    }

    const v3Raw = target.getItem(PREVIOUS_STORAGE_KEY);
    if (v3Raw !== null) {
      try {
        const v3: unknown = JSON.parse(v3Raw);
        if (isV3Draft(v3)) return saveMigratedDraft(target, PREVIOUS_STORAGE_KEY, migrateV3(v3));
      } catch { /* Try older draft formats. */ }
    }

    const v2Raw = target.getItem(OLDER_STORAGE_KEY);
    if (v2Raw !== null) {
      try {
        const v2: unknown = JSON.parse(v2Raw);
        if (isV2Draft(v2)) return saveMigratedDraft(target, OLDER_STORAGE_KEY, migrateV2(v2));
      } catch { /* Try the oldest draft format. */ }
    }

    const legacyRaw = target.getItem(LEGACY_STORAGE_KEY);
    if (legacyRaw !== null) {
      try {
        const legacy: unknown = JSON.parse(legacyRaw);
        if (isLegacyDraft(legacy)) return saveMigratedDraft(target, LEGACY_STORAGE_KEY, migrateLegacyDraft(legacy, movementCategories));
      } catch { /* Show the invalid-draft warning below. */ }
    }

    if (currentInvalid || v5Raw !== null || v4Raw !== null || v3Raw !== null || v2Raw !== null || legacyRaw !== null) {
      return { draft: defaultDraft(), warning: 'Le brouillon enregistré est invalide. Un nouveau projet a été ouvert.', migrated: false };
    }
    return { draft: defaultDraft(), warning: null, migrated: false };
  } catch {
    return { draft: defaultDraft(), warning: 'Le brouillon enregistré est illisible ou le stockage local est indisponible.', migrated: false };
  }
}

export function hasStartedLine(line: ChoreographyLine): boolean {
  return [line.attacker, line.handMovement, line.footMovement, line.details, line.defender, line.defenderMovement, line.defenderDetails].some((part) => part.trim());
}

export function calculateOppositionDuration(draft: ProjectDraft): string {
  let previousEnd = 0;
  let totalSeconds = 0;
  for (const section of draft.sections) {
    if (section.type === 'phrase' && section.lines.some(hasStartedLine)) totalSeconds += section.end - previousEnd;
    previousEnd = section.end;
  }
  const totalMilliseconds = Math.round((totalSeconds + 1e-9) * 1000);
  const minutes = Math.floor(totalMilliseconds / 60000);
  const secondsAndFraction = ((totalMilliseconds % 60000) / 1000).toFixed(3).padStart(6, '0').replace(/\.?0+$/, '');
  return `${String(minutes).padStart(2, '0')}m:${secondsAndFraction}s`;
}

function allLines(draft: ProjectDraft): ChoreographyLine[] {
  return draft.sections.flatMap((section) => section.type === 'phrase' ? section.lines : []);
}

export function getExportError(draft: ProjectDraft): string | null {
  const lines = allLines(draft);
  if (!lines.some(hasStartedLine) && !draft.sections.some((section) => section.type === 'temps')) return 'Ajoutez au moins une action ou un temps chorégraphique avant de télécharger le projet.';
  let phraseIndex = 0;
  for (const section of draft.sections) {
    if (section.type !== 'phrase') continue;
    const phrase = section;
    phraseIndex += 1;
    const invalid = phrase.lines.findIndex((line) => hasStartedLine(line)
      && (!line.attacker.trim() || (!line.handMovement.trim() && !line.footMovement.trim())));
    if (invalid < 0) continue;
    const missing = [
      !phrase.lines[invalid].attacker.trim() && 'attaquant',
      !phrase.lines[invalid].handMovement.trim() && !phrase.lines[invalid].footMovement.trim() && 'mouvement de main ou de pieds',
    ].filter(Boolean);
    return `La ligne ${phraseIndex}.${invalid + 1} doit contenir ${missing.join(' et ')}.`;
  }
  return null;
}

function formatTime(value: number): string {
  return Number.isInteger(value) ? value.toFixed(1) : String(value);
}

function formatLine(line: ChoreographyLine): string {
  const details = line.details.trim();
  const defender = line.defender.trim();
  const movements = [line.handMovement.trim(), line.footMovement.trim()].filter(Boolean).join(' ');
  const reaction = defender ? [line.defenderMovement.trim(), line.defenderDetails.trim()].filter(Boolean).join(' ') : '';
  return `${line.attacker.trim()} ${movements}${details ? ` ${details}` : ''}${defender ? ` contre ${defender}${reaction ? ` qui ${reaction}` : ''}` : ''}`;
}

export function formatProject(draft: ProjectDraft): string {
  const output: string[] = [];
  let start = 0;
  let phraseNumber = 0;
  let timeNumber = 0;
  for (const section of draft.sections) {
    if (section.type === 'temps') {
      const number = ++timeNumber;
      output.push(`${formatTime(start)} - Début Temps chorégraphique ${number}`);
      output.push(`${formatTime(section.end)} - Fin Temps chorégraphique ${number}`);
      output.push('');
      start = section.end;
      continue;
    }
    const number = ++phraseNumber;
    const lines = section.lines.filter(hasStartedLine);
    if (lines.length) {
      output.push(`${formatTime(start)} - Début Phrase ${number}`);
      lines.forEach((line, index) => output.push(`${number}.${index + 1} - ${formatLine(line)}`));
      output.push(`${formatTime(section.end)} - Fin Phrase ${number}`);
      output.push('');
    }
    start = section.end;
  }
  if (output.at(-1) === '') output.pop();
  return output.join('\n');
}
