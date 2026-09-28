export const STORAGE_KEY = 'forgechoree.project.v3';
export const PREVIOUS_STORAGE_KEY = 'forgechoree.project.v2';
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

export type ProjectDraft = {
  fighters: string[];
  lines: ChoreographyLine[];
};

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

type PreviousChoreographyLine = Omit<ChoreographyLine, 'defenderMovement' | 'defenderDetails'>;
type PreviousProjectDraft = { fighters: string[]; lines: PreviousChoreographyLine[] };

type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export const defaultDraft = (): ProjectDraft => ({
  fighters: ['Combattant A', 'Combattant B'],
  lines: [{ id: createLineId(), attacker: '', handMovement: '', footMovement: '', details: '', defender: '', defenderMovement: '', defenderDetails: '' }],
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

function isValidDraftBase(value: unknown): value is { fighters: string[]; lines: unknown[] } {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as { fighters?: unknown; lines?: unknown };
  return Array.isArray(candidate.fighters)
    && Array.isArray(candidate.lines)
    && candidate.fighters.length <= MAX_FIGHTERS
    && candidate.lines.length <= MAX_LINES
    && candidate.fighters.every((fighter) => isValidText(fighter, MAX_NAME_LENGTH));
}

export function isProjectDraft(value: unknown): value is ProjectDraft {
  if (!isValidDraftBase(value)) return false;
  const ids = new Set<string>();
  return value.lines.every((line) => {
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
  });
}

function isPreviousProjectDraft(value: unknown): value is PreviousProjectDraft {
  if (!isValidDraftBase(value)) return false;
  const ids = new Set<string>();
  return value.lines.every((line) => {
    if (!line || typeof line !== 'object') return false;
    const row = line as PreviousChoreographyLine;
    return isValidLineId(row.id, ids)
      && isValidText(row.attacker, MAX_NAME_LENGTH)
      && isValidText(row.handMovement, MAX_NAME_LENGTH)
      && isValidText(row.footMovement, MAX_NAME_LENGTH)
      && isValidText(row.defender, MAX_NAME_LENGTH)
      && isValidText(row.details, MAX_DETAILS_LENGTH);
  });
}

function migratePreviousDraft(previous: PreviousProjectDraft): ProjectDraft {
  return {
    fighters: [...previous.fighters],
    lines: previous.lines.map((line) => ({ ...line, defenderMovement: '', defenderDetails: '' })),
  };
}

function isLegacyProjectDraft(value: unknown): value is LegacyProjectDraft {
  if (!isValidDraftBase(value)) return false;
  const ids = new Set<string>();
  return value.lines.every((line) => {
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
  return {
    fighters: [...legacy.fighters],
    lines: legacy.lines.map(({ action, ...line }) => {
      const category = movementCategories.get(normalizeSearch(action.trim())) ?? 'main';
      return {
        ...line,
        handMovement: category === 'pieds' ? '' : action,
        footMovement: category === 'pieds' ? action : '',
        defenderMovement: '',
        defenderDetails: '',
      };
    }),
  };
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

    const previousRaw = target.getItem(PREVIOUS_STORAGE_KEY);
    if (previousRaw !== null) {
      let previous: unknown = null;
      try { previous = JSON.parse(previousRaw); } catch { /* Try the older draft format below. */ }
      if (isPreviousProjectDraft(previous)) {
        const draft = migratePreviousDraft(previous);
        try {
          target.setItem(STORAGE_KEY, JSON.stringify(draft));
          target.removeItem(PREVIOUS_STORAGE_KEY);
        } catch {
          return { draft, warning: 'Le brouillon a Ã©tÃ© converti, mais nâ€™a pas pu Ãªtre enregistrÃ© dans le stockage local.', migrated: true };
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

    if (currentInvalid || previousRaw !== null) {
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

export function getExportError(lines: ChoreographyLine[]): string | null {
  if (!lines.some(isLineStarted)) return 'Ajoutez au moins une action avant de télécharger le projet.';
  const invalid = lines.findIndex((line) => isLineStarted(line)
    && (!line.attacker.trim() || (!line.handMovement.trim() && !line.footMovement.trim())));
  if (invalid >= 0) {
    const missing = [
      !lines[invalid].attacker.trim() && 'attaquant',
      !lines[invalid].handMovement.trim() && !lines[invalid].footMovement.trim() && 'mouvement de main ou de pieds',
    ].filter(Boolean);
    return `La ligne ${invalid + 1} doit contenir ${missing.join(' et ')}.`;
  }
  return null;
}

export function formatProject(lines: ChoreographyLine[]): string {
  return lines.filter(isLineStarted).map((line, index) => {
    const details = line.details.trim();
    const defender = line.defender.trim();
    const movements = [line.handMovement.trim(), line.footMovement.trim()].filter(Boolean).join(' ');
    const reaction = defender
      ? [line.defenderMovement.trim(), line.defenderDetails.trim()].filter(Boolean).join(' ')
      : '';
    return `${index + 1}. ${line.attacker.trim()} ${movements}${details ? ` ${details}` : ''}${defender ? ` contre ${defender}${reaction ? ` qui ${reaction}` : ''}` : ''}`;
  }).join('\n');
}
