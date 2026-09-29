export const STORAGE_KEY = 'forgechoree.project.v4';
export const PREVIOUS_STORAGE_KEY = 'forgechoree.project.v3';
export const OLDER_STORAGE_KEY = 'forgechoree.project.v2';
export const LEGACY_STORAGE_KEY = 'forgechoree.project.v1';
export const MAX_NAME_LENGTH = 100;
export const MAX_DETAILS_LENGTH = 500;
export const MAX_FIGHTERS = 50;
export const MAX_LINES = 500;

export type MovementCategory = 'main' | 'pieds' | 'combine';

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
  id: string;
  end: number;
  lines: ChoreographyLine[];
};

export type ProjectDraft = {
  fighters: string[];
  phrases: PhraseDArmes[];
};

type V3ProjectDraft = { fighters: string[]; lines: ChoreographyLine[] };

type LegacyChoreographyLine = {
  id: string;
  attacker: string;
  action: string;
  details: string;
  defender: string;
};

type LegacyProjectDraft = {
  fighters: string[];
  lines: LegacyChoreographyLine[];
};

type V2ChoreographyLine = Omit<ChoreographyLine, 'defenderMovement' | 'defenderDetails'>;
type V2ProjectDraft = { fighters: string[]; lines: V2ChoreographyLine[] };

type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export const defaultDraft = (): ProjectDraft => ({
  fighters: ['Combattant A', 'Combattant B'],
  phrases: [{
    id: createLineId(),
    end: 0,
    lines: [{ id: createLineId(), attacker: '', handMovement: '', footMovement: '', details: '', defender: '', defenderMovement: '', defenderDetails: '' }],
  }],
});

export function createLineId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `line-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function normalizeSingleLine(value: string, maxLength: number): string {
  return value
    .normalize('NFC')
    .replace(/[\r\n\u0000-\u001f\u007f]/g, '')
    .slice(0, maxLength);
}

export function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('fr');
}

function isValidText(value: unknown, maxLength: number): value is string {
  return typeof value === 'string'
    && value.length <= maxLength
    && !/[\r\n\u0000-\u001f\u007f]/.test(value);
}

function isValidLineId(value: unknown, ids: Set<string>): value is string {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(value) || ids.has(value)) return false;
  ids.add(value);
  return true;
}

function isValidFighters(value: unknown): value is string[] {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as { fighters?: unknown };
  return Array.isArray(candidate.fighters)
    && candidate.fighters.length <= MAX_FIGHTERS
    && candidate.fighters.every((fighter) => isValidText(fighter, MAX_NAME_LENGTH));
}

function isValidChoreographyLine(line: unknown, ids: Set<string>): line is ChoreographyLine {
    if (!line || typeof line !== 'object') return false;
    const row = line as ChoreographyLine;
    return isValidLineId(row.id, ids)
      && isValidText(row.attacker, MAX_NAME_LENGTH)
      && isValidText(row.handMovement, MAX_NAME_LENGTH)
      && isValidText(row.footMovement, MAX_NAME_LENGTH)
      && isValidText(row.defender, MAX_NAME_LENGTH)
      && isValidText(row.details, MAX_DETAILS_LENGTH)
      && isValidText(row.defenderMovement, MAX_NAME_LENGTH)
      && isValidText(row.defenderDetails, MAX_DETAILS_LENGTH);
}

function isV3ProjectDraft(value: unknown): value is V3ProjectDraft {
  if (!isValidFighters(value)) return false;
  const candidate = value as { lines?: unknown };
  if (!Array.isArray(candidate.lines) || candidate.lines.length > MAX_LINES) return false;
  const ids = new Set<string>();
  return candidate.lines.every((line) => isValidChoreographyLine(line, ids));
}

export function isProjectDraft(value: unknown): value is ProjectDraft {
  if (!isValidFighters(value)) return false;
  const candidate = value as { phrases?: unknown };
  if (!Array.isArray(candidate.phrases) || candidate.phrases.length === 0) return false;
  let totalLines = 0;
  const ids = new Set<string>();
  let previousEnd = 0;
  return candidate.phrases.every((phrase) => {
    if (!phrase || typeof phrase !== 'object') return false;
    const row = phrase as PhraseDArmes;
    if (!isValidLineId(row.id, ids)
      || typeof row.end !== 'number'
      || !Number.isFinite(row.end)
      || row.end < previousEnd
      || !Array.isArray(row.lines)) return false;
    previousEnd = row.end;
    totalLines += row.lines.length;
    return totalLines <= MAX_LINES && row.lines.every((line) => isValidChoreographyLine(line, ids));
  });
}

function isV2ProjectDraft(value: unknown): value is V2ProjectDraft {
  if (!isValidFighters(value)) return false;
  const candidate = value as { lines?: unknown };
  if (!Array.isArray(candidate.lines) || candidate.lines.length > MAX_LINES) return false;
  const ids = new Set<string>();
  return candidate.lines.every((line) => {
    if (!line || typeof line !== 'object') return false;
    const row = line as V2ChoreographyLine;
    return isValidLineId(row.id, ids)
      && isValidText(row.attacker, MAX_NAME_LENGTH)
      && isValidText(row.handMovement, MAX_NAME_LENGTH)
      && isValidText(row.footMovement, MAX_NAME_LENGTH)
      && isValidText(row.defender, MAX_NAME_LENGTH)
      && isValidText(row.details, MAX_DETAILS_LENGTH);
  });
}

function wrapLinesInFirstPhrase(fighters: string[], lines: ChoreographyLine[]): ProjectDraft {
  return {
    fighters: [...fighters],
    phrases: [{ id: createLineId(), end: 0, lines: lines.map((line) => ({ ...line })) }],
  };
}

function isLegacyProjectDraft(value: unknown): value is LegacyProjectDraft {
  if (!isValidFighters(value)) return false;
  const candidate = value as { lines?: unknown };
  if (!Array.isArray(candidate.lines) || candidate.lines.length > MAX_LINES) return false;
  const ids = new Set<string>();
  return candidate.lines.every((line) => {
    if (!line || typeof line !== 'object') return false;
    const row = line as LegacyChoreographyLine;
    return isValidLineId(row.id, ids)
      && isValidText(row.attacker, MAX_NAME_LENGTH)
      && isValidText(row.action, MAX_NAME_LENGTH)
      && isValidText(row.defender, MAX_NAME_LENGTH)
      && isValidText(row.details, MAX_DETAILS_LENGTH);
  });
}

export function migrateLegacyDraft(
  legacy: LegacyProjectDraft,
  movementCategories: ReadonlyMap<string, MovementCategory>,
): ProjectDraft {
  const lines = legacy.lines.map(({ action, ...line }) => {
      const category = movementCategories.get(normalizeSearch(action.trim())) ?? 'main';
      return {
        ...line,
        handMovement: category === 'pieds' ? '' : action,
        footMovement: category === 'pieds' ? action : '',
        defenderMovement: '',
        defenderDetails: '',
      };
    });
  return wrapLinesInFirstPhrase(legacy.fighters, lines);
}

export type LoadedDraft = { draft: ProjectDraft; warning: string | null; migrated: boolean };

export function loadDraft(
  storage?: DraftStorage,
  movementCategories: ReadonlyMap<string, MovementCategory> = new Map(),
): LoadedDraft {
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
      } catch {
        currentInvalid = true;
      }
    }

    const v3Raw = target.getItem(PREVIOUS_STORAGE_KEY);
    if (v3Raw !== null) {
      let v3: unknown = null;
      try { v3 = JSON.parse(v3Raw); } catch { /* Try the older draft formats below. */ }
      if (isV3ProjectDraft(v3)) {
        const draft = wrapLinesInFirstPhrase(v3.fighters, v3.lines);
        try {
          target.setItem(STORAGE_KEY, JSON.stringify(draft));
          target.removeItem(PREVIOUS_STORAGE_KEY);
        } catch {
          return { draft, warning: 'Le brouillon a été converti, mais n’a pas pu être enregistré dans le stockage local.', migrated: true };
        }
        return { draft, warning: null, migrated: true };
      }
    }

    const v2Raw = target.getItem(OLDER_STORAGE_KEY);
    if (v2Raw !== null) {
      let v2: unknown = null;
      try { v2 = JSON.parse(v2Raw); } catch { /* Try the older draft format below. */ }
      if (isV2ProjectDraft(v2)) {
        const lines = v2.lines.map((line) => ({ ...line, defenderMovement: '', defenderDetails: '' }));
        const draft = wrapLinesInFirstPhrase(v2.fighters, lines);
        try {
          target.setItem(STORAGE_KEY, JSON.stringify(draft));
          target.removeItem(OLDER_STORAGE_KEY);
        } catch {
          return { draft, warning: 'Le brouillon a été converti, mais n’a pas pu être enregistré dans le stockage local.', migrated: true };
        }
        return { draft, warning: null, migrated: true };
      }
    }

    const legacyRaw = target.getItem(LEGACY_STORAGE_KEY);
    if (legacyRaw !== null) {
      const legacy: unknown = JSON.parse(legacyRaw);
      if (!isLegacyProjectDraft(legacy)) {
        return { draft: defaultDraft(), warning: 'Le brouillon enregistré est invalide. Un nouveau projet a été ouvert.', migrated: false };
      }
      const draft = migrateLegacyDraft(legacy, movementCategories);
      try {
        target.setItem(STORAGE_KEY, JSON.stringify(draft));
        target.removeItem(LEGACY_STORAGE_KEY);
      } catch {
        return { draft, warning: 'Le brouillon a été converti, mais n’a pas pu être enregistré dans le stockage local.', migrated: true };
      }
      return { draft, warning: null, migrated: true };
    }

    if (currentInvalid || v3Raw !== null || v2Raw !== null) {
      return { draft: defaultDraft(), warning: 'Le brouillon enregistré est invalide. Un nouveau projet a été ouvert.', migrated: false };
    }
    return { draft: defaultDraft(), warning: null, migrated: false };
  } catch {
    return { draft: defaultDraft(), warning: 'Le brouillon enregistré est illisible ou le stockage local est indisponible.', migrated: false };
  }
}

function isLineStarted(line: ChoreographyLine): boolean {
  return [line.attacker, line.handMovement, line.footMovement, line.details, line.defender, line.defenderMovement, line.defenderDetails].some((part) => part.trim());
}

function allLines(draft: ProjectDraft): ChoreographyLine[] {
  return draft.phrases.flatMap((phrase) => phrase.lines);
}

export function getExportError(draft: ProjectDraft): string | null {
  const lines = allLines(draft);
  if (!lines.some(isLineStarted)) return 'Ajoutez au moins une action avant de télécharger le projet.';
  for (const [phraseIndex, phrase] of draft.phrases.entries()) {
    const invalid = phrase.lines.findIndex((line) => isLineStarted(line)
      && (!line.attacker.trim() || (!line.handMovement.trim() && !line.footMovement.trim())));
    if (invalid < 0) continue;
    const missing = [
      !phrase.lines[invalid].attacker.trim() && 'attaquant',
      !phrase.lines[invalid].handMovement.trim() && !phrase.lines[invalid].footMovement.trim() && 'mouvement de main ou de pieds',
    ].filter(Boolean);
    return `La ligne ${phraseIndex + 1}.${invalid + 1} doit contenir ${missing.join(' et ')}.`;
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
    const reaction = defender
      ? [line.defenderMovement.trim(), line.defenderDetails.trim()].filter(Boolean).join(' ')
      : '';
  return `${line.attacker.trim()} ${movements}${details ? ` ${details}` : ''}${defender ? ` contre ${defender}${reaction ? ` qui ${reaction}` : ''}` : ''}`;
}

export function formatProject(draft: ProjectDraft): string {
  const output: string[] = [];
  let start = 0;
  for (const [phraseIndex, phrase] of draft.phrases.entries()) {
    const lines = phrase.lines.filter(isLineStarted);
    if (lines.length) {
      const number = phraseIndex + 1;
      output.push(`${formatTime(start)} - Début Phrase ${number}`);
      lines.forEach((line, index) => output.push(`${number}.${index + 1} - ${formatLine(line)}`));
      output.push(`${formatTime(phrase.end)} - Fin Phrase ${number}`);
      output.push('');
    }
    start = phrase.end;
  }
  if (output.at(-1) === '') output.pop();
  return output.join('\n');
}
