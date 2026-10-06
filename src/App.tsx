import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import movementData from './data/mouvements.json';
import AutocompleteInput from './components/AutocompleteInput';
import GuidedTour from './components/GuidedTour';
import {
  createLineId,
  calculateOppositionDuration,
  defaultDraft,
  formatProject,
  getExportError,
  hasStartedLine,
  loadDraft,
  LEGACY_STORAGE_KEY,
  OLDER_STORAGE_KEY,
  PREVIOUS_STORAGE_KEY,
  MAX_DETAILS_LENGTH,
  MAX_PROJECT_INFO_LENGTH,
  MAX_DURATION_LENGTH,
  MAX_ASSISTANTS,
  MAX_FIGHTERS,
  MAX_LINES,
  MAX_NAME_LENGTH,
  normalizeSearch,
  normalizeMultiLine,
  normalizeSingleLine,
  STORAGE_KEY,
  V4_STORAGE_KEY,
  V5_STORAGE_KEY,
  createProjectFile,
  parseProjectFile,
  MAX_PROJECT_FILE_BYTES,
  type ChoreographyLine,
  type Fighter,
  type Assistant,
  type ProjectInfo,
  type MovementCategory,
  type ChoreographySection,
  type PhraseDArmes,
} from './lib/project';

type Movement = { nom: string; description: string; categorie: MovementCategory; caracteristiques?: string[] };
function isMovementList(value: unknown): value is Movement[] {
  return Array.isArray(value) && value.length <= 1000 && value.every((item) =>
    !!item && typeof item === 'object'
    && typeof (item as Movement).nom === 'string'
    && (item as Movement).nom.trim().length > 0
    && (item as Movement).nom.length <= 100
    && typeof (item as Movement).description === 'string'
    && (item as Movement).description.length <= 1000
    && ((item as Movement).caracteristiques === undefined || (Array.isArray((item as Movement).caracteristiques)
      && (item as Movement).caracteristiques!.length <= 100
      && (item as Movement).caracteristiques!.every((value) => typeof value === 'string' && value.trim().length > 0 && value.length <= 100 && !/[\r\n\u0000-\u001f\u007f]/.test(value))))
    && ['main', 'pieds', 'combine'].includes((item as Movement).categorie));
}

const movementList = isMovementList(movementData) ? movementData : [];
const combinedMovementNames = new Set(movementList.filter((movement) => movement.categorie === 'combine').map((movement) => normalizeSearch(movement.nom)));
const isCombinedMovement = (value: string) => combinedMovementNames.has(normalizeSearch(value.trim()));
const characteristicsByMovement = new Map(movementList.filter((movement) => movement.caracteristiques?.length).map((movement) => [normalizeSearch(movement.nom), movement.caracteristiques ?? []]));
const getCharacteristics = (...names: string[]) => [...new Set(names.flatMap((name) => characteristicsByMovement.get(normalizeSearch(name.trim())) ?? []))];
const movementCategories = new Map(movementList.map((movement) => [normalizeSearch(movement.nom), movement.categorie]));
const initialState = loadDraft(undefined, movementCategories);
const createEmptyLine = (): ChoreographyLine => ({ id: createLineId(), attacker: '', handMovement: '', footMovement: '', details: '', defender: '', defenderMovement: '', defenderDetails: '' });
const createEmptyAssistant = (): Assistant => ({ id: createLineId(), firstName: '', lastName: '', licenseNumber: '', role: '' });
const phraseSections = (sections: ChoreographySection[]) => sections.filter((section): section is PhraseDArmes => section.type === 'phrase');
const sectionStart = (sections: ChoreographySection[], index: number) => index === 0 ? 0 : sections[index - 1].end;
const phraseStart = (sections: ChoreographySection[], index: number) => sectionStart(sections, index);
const formatTiming = (value: number) => Number.isInteger(value) ? value.toFixed(1) : String(value);

export default function App() {
  const [draft, setDraft] = useState(initialState.draft);
  const [notice, setNotice] = useState(initialState.warning);
  const [exportError, setExportError] = useState<string | null>(null);
  const [openDescription, setOpenDescription] = useState<string | null>(null);
  const [fighterEdits, setFighterEdits] = useState<Record<string, string>>({});
  const [timingEdits, setTimingEdits] = useState<Record<string, string>>({});
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [tourOpen, setTourOpen] = useState(false);
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);
  const [pdfFormat, setPdfFormat] = useState('A4-landscape');
  const hasEdited = useRef(false);
  const pendingPhraseFocus = useRef<string | null>(null);
  const downloadMenuRef = useRef<HTMLDivElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const pdfDialogRef = useRef<HTMLDialogElement>(null);
  const fighterSuggestions = useMemo(() => draft.fighters.map((fighter) => fighter.name).filter(Boolean), [draft.fighters]);
  const movementSuggestions = useMemo(() => movementList.map((movement) => movement.nom), []);
  const handSuggestions = useMemo(() => movementList.filter((movement) => movement.categorie === 'main' || movement.categorie === 'combine').map((movement) => movement.nom), []);
  const footSuggestions = useMemo(() => movementList.filter((movement) => movement.categorie === 'pieds').map((movement) => movement.nom), []);
  const projectCategory = draft.fighters.length === 0
    ? 'Non définie'
    : draft.fighters.length === 1 ? 'Kata'
      : draft.fighters.length === 2 ? 'Duel'
        : draft.info.ensemble ? 'Ensemble' : 'Bataille';

  useEffect(() => {
    if (!hasEdited.current) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    } catch {
      setNotice('Le brouillon reste ouvert mais ne peut pas être enregistré localement. Téléchargez une copie JSON avant de fermer cette page.');
    }
  }, [draft]);

  useEffect(() => {
    if (!downloadMenuOpen) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!downloadMenuRef.current?.contains(event.target as Node)) setDownloadMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDownloadMenuOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [downloadMenuOpen]);

  useEffect(() => {
    const dialog = pdfDialogRef.current;
    if (!dialog) return;
    if (pdfDialogOpen && !dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    }
    if (!pdfDialogOpen && dialog.open) {
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    }
  }, [pdfDialogOpen]);

  useEffect(() => {
    if (!pendingPhraseFocus.current) return;
    document.querySelector<HTMLElement>(`[data-phrase-focus="${pendingPhraseFocus.current}"]`)?.focus();
    pendingPhraseFocus.current = null;
  }, [draft.sections]);

  function changeDraft(nextDraft: typeof draft) {
    hasEdited.current = true;
    setDraft(nextDraft);
    setNotice(null);
  }

  function updateFighterEdit(id: string, value: string) {
    setFighterEdits((edits) => ({ ...edits, [id]: value }));
  }

  function commitFighterEdit(id: string) {
    const editedName = fighterEdits[id];
    if (editedName === undefined) return;
    const newName = normalizeSingleLine(editedName, MAX_NAME_LENGTH);
    const fighter = draft.fighters.find((candidate) => candidate.id === id);
    setFighterEdits(({ [id]: _discarded, ...edits }) => edits);
    if (!fighter || !newName.trim() || fighter.name === newName) return;
    const fighters = draft.fighters.map((candidate) => candidate.id === id ? { ...candidate, name: newName } : candidate);
    const sections = fighter.name ? draft.sections.map((section) => section.type === 'phrase' ? ({
      ...section,
      lines: section.lines.map((line) => ({
        ...line,
        attacker: line.attacker === fighter.name ? newName : line.attacker,
        defender: line.defender === fighter.name ? newName : line.defender,
      })),
    }) : section) : draft.sections;
    changeDraft({ ...draft, fighters, sections });
  }

  function addFighter() {
    if (draft.fighters.length < MAX_FIGHTERS) changeDraft({ ...draft, fighters: [...draft.fighters, { id: createLineId(), name: '', firstName: '', lastName: '', licenseNumber: '', captain: false }] });
  }

  function removeFighter(id: string) {
    changeDraft({ ...draft, fighters: draft.fighters.filter((fighter) => fighter.id !== id) });
    setFighterEdits(({ [id]: _discarded, ...edits }) => edits);
  }

  function updateProjectInfo<K extends keyof ProjectInfo>(field: K, value: ProjectInfo[K]) {
    changeDraft({ ...draft, info: { ...draft.info, [field]: value } });
  }

  function updateFighter(id: string, field: keyof Omit<Fighter, 'id' | 'name'>, value: string | boolean) {
    changeDraft({ ...draft, fighters: draft.fighters.map((fighter) => fighter.id === id ? { ...fighter, [field]: value } : fighter) });
  }

  function addAssistant() {
    if (draft.assistants.length < MAX_ASSISTANTS) changeDraft({ ...draft, assistants: [...draft.assistants, createEmptyAssistant()] });
  }

  function updateAssistant(id: string, field: keyof Omit<Assistant, 'id'>, value: string) {
    changeDraft({ ...draft, assistants: draft.assistants.map((assistant) => assistant.id === id ? { ...assistant, [field]: normalizeSingleLine(value, MAX_NAME_LENGTH) } : assistant) });
  }

  function removeAssistant(id: string) {
    changeDraft({ ...draft, assistants: draft.assistants.filter((assistant) => assistant.id !== id) });
  }

  function calculateOppositionTime() {
    updateProjectInfo('oppositionDuration', calculateOppositionDuration(draft));
  }

  function updateLine(id: string, field: keyof Omit<ChoreographyLine, 'id'>, value: string) {
    const limit = field === 'details' ? MAX_DETAILS_LENGTH : MAX_NAME_LENGTH;
    const normalized = normalizeSingleLine(value, limit);
    changeDraft({ ...draft, sections: draft.sections.map((section) => section.type === 'phrase' ? ({
      ...section,
      lines: section.lines.map((line) => line.id === id
        ? { ...line, [field]: normalized, ...(field === 'handMovement' && isCombinedMovement(normalized) ? { footMovement: '' } : {}) }
        : line),
    }) : section) });
    setExportError(null);
  }

  function addLine(phraseId: string, afterId?: string) {
    const lineCount = phraseSections(draft.sections).reduce((count, phrase) => count + phrase.lines.length, 0);
    if (lineCount >= MAX_LINES) return;
    const sections = draft.sections.map((section) => {
      if (section.type !== 'phrase' || section.id !== phraseId) return section;
      const lines = [...section.lines];
      const index = afterId ? lines.findIndex((line) => line.id === afterId) : lines.length - 1;
      lines.splice(index + 1, 0, createEmptyLine());
      return { ...section, lines };
    });
    changeDraft({ ...draft, sections });
    setExportError(null);
  }

  function addPhrase() {
    const end = draft.sections.at(-1)?.end ?? 0;
    changeDraft({ ...draft, sections: [...draft.sections, { type: 'phrase', id: createLineId(), end, lines: [] }] });
    setExportError(null);
  }

  function addChoreographicTime() {
    const end = draft.sections.at(-1)?.end ?? 0;
    changeDraft({ ...draft, sections: [...draft.sections, { type: 'temps', id: createLineId(), end }] });
    setExportError(null);
  }

  function removeChoreographicTime(id: string) {
    const index = draft.sections.findIndex((section) => section.id === id && section.type === 'temps');
    if (index < 0) return;
    const section = draft.sections[index];
    if (section.type !== 'temps') return;
    const duration = section.end - sectionStart(draft.sections, index);
    if (duration > 0 && !window.confirm(`Supprimer Temps chorégraphique ${draft.sections.slice(0, index + 1).filter((item) => item.type === 'temps').length} ? Les sections suivantes avanceront pour préserver leur durée.`)) return;
    const sections = draft.sections.filter((candidate) => candidate.id !== id);
    for (let next = index; next < sections.length; next += 1) sections[next] = { ...sections[next], end: Math.max(next ? sections[next - 1].end : 0, sections[next].end - duration) };
    const shiftedIds = new Set(draft.sections.slice(index).map((candidate) => candidate.id));
    setTimingEdits((edits) => Object.fromEntries(Object.entries(edits).filter(([sectionId]) => !shiftedIds.has(sectionId))));
    changeDraft({ ...draft, sections });
    setExportError(null);
  }

  function moveSection(id: string, offset: -1 | 1) {
    const index = draft.sections.findIndex((section) => section.id === id);
    const target = index + offset;
    if (index < 0 || target < 0 || target >= draft.sections.length) return;
    const durations = new Map(draft.sections.map((section, i) => [section.id, section.end - sectionStart(draft.sections, i)]));
    const sections = [...draft.sections];
    [sections[index], sections[target]] = [sections[target], sections[index]];
    let end = 0;
    for (const section of sections) {
      end += durations.get(section.id) ?? 0;
      section.end = end;
    }
    changeDraft({ ...draft, sections });
    setTimingEdits({});
  }

  function moveSectionTo(id: string, targetId: string, after: boolean) {
    if (id === targetId) return;
    const from = draft.sections.findIndex((section) => section.id === id);
    const to = draft.sections.findIndex((section) => section.id === targetId);
    if (from < 0 || to < 0) return;
    const durations = new Map(draft.sections.map((section, index) => [section.id, section.end - sectionStart(draft.sections, index)]));
    const sections = [...draft.sections];
    const [section] = sections.splice(from, 1);
    const targetIndex = sections.findIndex((item) => item.id === targetId);
    sections.splice(targetIndex + (after ? 1 : 0), 0, section);
    let end = 0;
    for (const item of sections) { end += durations.get(item.id) ?? 0; item.end = end; }
    changeDraft({ ...draft, sections });
    setTimingEdits({});
  }

  function handleSectionDrop(event: DragEvent<HTMLElement>, targetId: string) {
    const dragged = event.dataTransfer.getData('application/x-section');
    if (!dragged) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    moveSectionTo(dragged, targetId, event.clientY > rect.top + rect.height / 2);
  }

  function removePhrase(id: string) {
    const phrases = phraseSections(draft.sections);
    if (phrases.length <= 1) return;
    const index = draft.sections.findIndex((section) => section.id === id && section.type === 'phrase');
    if (index < 0) return;
    const phrase = draft.sections[index];
    if (phrase.type !== 'phrase') return;
    const phraseNumber = phraseSections(draft.sections.slice(0, index + 1)).length;
    if (phrase.lines.some(hasStartedLine) && !window.confirm(`Supprimer Phrase d’armes ${phraseNumber} et ses lignes d’action ? Cette action ne peut pas être annulée.`)) return;

    const duration = phrase.end - phraseStart(draft.sections, index);
    const sections = draft.sections.filter((candidate) => candidate.id !== id);
    for (let next = index; next < sections.length; next += 1) {
      const previousEnd = next === 0 ? 0 : sections[next - 1].end;
      sections[next] = { ...sections[next], end: Math.max(previousEnd, sections[next].end - duration) };
    }
    pendingPhraseFocus.current = sections.slice(index).find((section) => section.type === 'phrase')?.id
      ?? sections.slice(0, index).reverse().find((section) => section.type === 'phrase')?.id ?? null;
    const shiftedPhraseIds = new Set(draft.sections.slice(index).map((candidate) => candidate.id));
    setTimingEdits((edits) => Object.fromEntries(Object.entries(edits).filter(([phraseId]) => !shiftedPhraseIds.has(phraseId))));
    setDropTarget(null);
    changeDraft({ ...draft, sections });
    setExportError(null);
  }

  function removeLine(id: string) {
    changeDraft({ ...draft, sections: draft.sections.map((section) => section.type === 'phrase'
      ? { ...section, lines: section.lines.filter((line) => line.id !== id) } : section) });
    setExportError(null);
  }

  function moveLineTo(lineId: string, targetPhraseIndex: number, targetLineId?: string, after = false) {
    const phrases = phraseSections(draft.sections);
    if (!phrases[targetPhraseIndex]) return;
    const sections = draft.sections.map((section) => section.type === 'phrase' ? { ...section, lines: [...section.lines] } : section);
    const sourcePhraseIndex = phrases.findIndex((phrase) => phrase.lines.some((line) => line.id === lineId));
    if (sourcePhraseIndex < 0 || (targetLineId && targetLineId === lineId)) return;
    const sourcePhrase = sections.find((section) => section.type === 'phrase' && section.id === phrases[sourcePhraseIndex].id);
    const targetPhrase = sections.find((section) => section.type === 'phrase' && section.id === phrases[targetPhraseIndex].id);
    if (sourcePhrase?.type !== 'phrase' || targetPhrase?.type !== 'phrase') return;
    const sourceLines = sourcePhrase.lines;
    const sourceIndex = sourceLines.findIndex((line) => line.id === lineId);
    const [line] = sourceLines.splice(sourceIndex, 1);
    const targetLines = targetPhrase.lines;
    const targetIndex = targetLineId ? targetLines.findIndex((candidate) => candidate.id === targetLineId) : targetLines.length;
    targetLines.splice(Math.max(0, targetIndex + (after ? 1 : 0)), 0, line);
    changeDraft({ ...draft, sections });
    setDropTarget(null);
    setExportError(null);
  }

  function moveLineAdjacent(lineId: string, direction: -1 | 1) {
    const phrases = phraseSections(draft.sections);
    const phraseIndex = phrases.findIndex((phrase) => phrase.lines.some((line) => line.id === lineId));
    if (phraseIndex < 0) return;
    const lines = phrases[phraseIndex].lines;
    const lineIndex = lines.findIndex((line) => line.id === lineId);
    if (direction < 0) {
      if (lineIndex > 0) moveLineTo(lineId, phraseIndex, lines[lineIndex - 1].id);
      else if (phraseIndex > 0) moveLineTo(lineId, phraseIndex - 1);
    } else if (lineIndex < lines.length - 1) {
      moveLineTo(lineId, phraseIndex, lines[lineIndex + 1].id, true);
    } else if (phraseIndex < phrases.length - 1) {
      moveLineTo(lineId, phraseIndex + 1, phrases[phraseIndex + 1].lines[0]?.id);
    }
  }

  function handleLineDragStart(event: DragEvent<HTMLButtonElement>, lineId: string) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', lineId);
  }

  function handleLineDrop(event: DragEvent<HTMLDivElement>, phraseIndex: number, lineId: string) {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const after = event.clientY > rect.top + rect.height / 2;
    moveLineTo(event.dataTransfer.getData('text/plain'), phraseIndex, lineId, after);
  }

  function handleEmptyPhraseDrop(event: DragEvent<HTMLDivElement>, phraseIndex: number) {
    event.preventDefault();
    moveLineTo(event.dataTransfer.getData('text/plain'), phraseIndex);
  }

  function commitSectionEnd(index: number, edited = timingEdits[draft.sections[index]?.id], clearEdit = true) {
    const section = draft.sections[index];
    if (!section || edited === undefined) return;
    if (clearEdit) setTimingEdits(({ [section.id]: _discarded, ...edits }) => edits);
    if (!edited.trim()) return;
    const value = Number(edited);
    if (!Number.isFinite(value) || value < 0) return;

    const sections = [...draft.sections];
    sections[index] = { ...section, end: Math.max(sectionStart(sections, index), value) };
    for (let next = index + 1; next < sections.length; next += 1) {
      const start = sections[next - 1].end;
      if (sections[next].end < start) sections[next] = { ...sections[next], end: start };
    }
    changeDraft({ ...draft, sections });
  }

  function handleDefenderBlur(id: string, defender: string) {
    if (defender.trim()) return;
    const line = phraseSections(draft.sections).flatMap((phrase) => phrase.lines).find((candidate) => candidate.id === id);
    if (!line || (!line.defenderMovement && !line.defenderDetails)) return;
    changeDraft({
      ...draft,
      sections: draft.sections.map((section) => section.type === 'phrase' ? ({
        ...section,
        lines: section.lines.map((candidate) => candidate.id === id
          ? { ...candidate, defenderMovement: '', defenderDetails: '' }
          : candidate),
      }) : section),
    });
    setExportError(null);
  }

  function exportProject() {
    const error = getExportError(draft);
    if (error) { setExportError(error); return; }
    downloadFile(`\uFEFF${formatProject(draft)}`, 'text/plain;charset=utf-8', 'txt');
    setExportError(null);
  }

  function clearLocalProject() {
    if (!window.confirm('Effacer le projet enregistré dans ce navigateur ? Cette action ne peut pas être annulée.')) return;
    let cleared = false;
    try {
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem(V5_STORAGE_KEY);
      window.localStorage.removeItem(V4_STORAGE_KEY);
      window.localStorage.removeItem(PREVIOUS_STORAGE_KEY);
      window.localStorage.removeItem(OLDER_STORAGE_KEY);
      window.localStorage.removeItem(LEGACY_STORAGE_KEY);
      cleared = true;
    } catch { /* State reset below still works for this session. */ }
    hasEdited.current = false;
    setDraft(defaultDraft());
    setNotice(cleared ? 'Le brouillon local a été effacé.' : 'Le brouillon local n’a pas pu être effacé de ce navigateur.');
    setExportError(null);
  }

  function downloadFile(contents: BlobPart, type: string, extension: string) {
    const url = URL.createObjectURL(new Blob([contents], { type }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `projet-choregraphique.${extension}`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function exportJson() {
    const json = JSON.stringify(createProjectFile(draft), null, 2);
    if (new TextEncoder().encode(json).byteLength > MAX_PROJECT_FILE_BYTES) {
      setExportError('Le projet dépasse la taille maximale de 10 Mo pour un fichier JSON.');
      return;
    }
    downloadFile(json, 'application/json;charset=utf-8', 'json');
    setDownloadMenuOpen(false);
    setExportError(null);
  }

  async function importJson(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    try {
      if (file.size > MAX_PROJECT_FILE_BYTES) {
        setNotice('Le fichier dépasse la taille maximale de 10 Mo.');
        return;
      }
      const importedDraft = parseProjectFile(await file.text());
      if (!importedDraft) {
        setNotice('Ce fichier JSON est invalide ou utilise une version non prise en charge. Le projet actuel est conservé.');
        return;
      }
      if (!window.confirm('Remplacer le projet actuel par celui du fichier JSON ? Cette action ne peut pas être annulée.')) return;
      hasEdited.current = true;
      setDraft(importedDraft);
      setNotice('Le projet JSON a été importé.');
      setExportError(null);
      setOpenDescription(null);
      setFighterEdits({});
      setTimingEdits({});
      setDropTarget(null);
      setDownloadMenuOpen(false);
      setPdfDialogOpen(false);
      setTourOpen(false);
    } catch {
      setNotice('Le fichier JSON n’a pas pu être lu. Le projet actuel est conservé.');
    } finally {
      input.value = '';
    }
  }

  async function exportPdf() {
    setPdfDialogOpen(false);
    setDownloadMenuOpen(false);
    try {
      const { downloadProjectPdf } = await import('./lib/pdf');
      await downloadProjectPdf(draft, pdfFormat);
      setExportError(null);
    } catch {
      setNotice('Le PDF n’a pas pu être généré. Vous pouvez toujours télécharger le projet en texte ou JSON.');
    }
  }

  const phrases = phraseSections(draft.sections);
  const lineCount = phrases.reduce((count, phrase) => count + phrase.lines.length, 0);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-mark" aria-hidden="true">✦</div>
        <div className="brand-copy">
          <p className="eyebrow">ATELIER DE CRÉATION CHORÉGRAPHIQUE · SABRE LASER</p>
          <h1>Forge Chorégraphique</h1>
        </div>
        <div className="topbar-actions">
          <button className="button button-muted" type="button" onClick={() => setTourOpen(true)}>Comment ça marche ?</button>
          <button className="button button-muted" type="button" onClick={clearLocalProject}>Effacer le brouillon local</button>
          <button className="button button-muted" type="button" data-tour="import" onClick={() => importInputRef.current?.click()}>Importer JSON</button>
          <input ref={importInputRef} type="file" hidden accept=".json,application/json" aria-label="Importer un projet JSON" onChange={importJson} />
          <div className="download-menu" ref={downloadMenuRef}>
            <button className="button button-primary" type="button" data-tour="download" aria-expanded={downloadMenuOpen} aria-controls="download-options" onClick={() => setDownloadMenuOpen((open) => !open)}><span aria-hidden="true">↓</span> Télécharger le projet</button>
            {downloadMenuOpen && <div className="download-options" id="download-options" aria-label="Formats de téléchargement">
              <button type="button" onClick={() => { exportProject(); setDownloadMenuOpen(false); }}>Texte (.txt)</button>
              <button type="button" onClick={() => { setDownloadMenuOpen(false); setPdfDialogOpen(true); }}>PDF ASL-FFE (.pdf)</button>
              <button type="button" onClick={exportJson}>Projet Forge Chorégraphique (.json)</button>
            </div>}
          </div>
        </div>
      </header>

      {(notice || !movementList.length) && <div className="notice" role="status">{notice ?? 'La liste des mouvements est indisponible.'}</div>}

      <div className="workspace">
        <aside className="sidebar" aria-label="Ressources du projet">
          <section className="panel fighters-panel" data-tour="fighters">
            <div className="section-heading">
              <div><p className="eyebrow">ÉQUIPE</p><h2>Combattants</h2></div>
              <span className="count-badge">{draft.fighters.length}</span>
            </div>
            <div className="fighter-list">
              {draft.fighters.map((fighter, index) => (
                <div className="fighter-card" key={fighter.id}>
                  <div className="fighter-row">
                    <span className="fighter-dot" aria-hidden="true" />
                    <input
                      aria-label={`Nom du combattant ${index + 1}`}
                      value={fighterEdits[fighter.id] ?? fighter.name}
                      maxLength={MAX_NAME_LENGTH}
                      autoComplete="off"
                      placeholder={`Combattant ${String.fromCharCode(65 + (index % 26))}`}
                      onFocus={() => updateFighterEdit(fighter.id, fighter.name)}
                      onChange={(event) => updateFighterEdit(fighter.id, event.target.value)}
                      onBlur={() => commitFighterEdit(fighter.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          commitFighterEdit(fighter.id);
                        }
                      }}
                    />
                    <button className="icon-button remove-fighter" type="button" aria-label={`Supprimer le combattant ${index + 1}`} onClick={() => removeFighter(fighter.id)}>×</button>
                  </div>
                  <details className="participant-details">
                    <summary aria-label={`Identité du combattant ${index + 1}`}>Fiche FFE</summary>
                    <div className="participant-fields">
                      <label>Prénom<input aria-label={`Prénom du combattant ${index + 1}`} maxLength={MAX_NAME_LENGTH} value={fighter.firstName} onChange={(event) => updateFighter(fighter.id, 'firstName', normalizeSingleLine(event.target.value, MAX_NAME_LENGTH))} /></label>
                      <label>Nom<input aria-label={`Nom de famille du combattant ${index + 1}`} maxLength={MAX_NAME_LENGTH} value={fighter.lastName} onChange={(event) => updateFighter(fighter.id, 'lastName', normalizeSingleLine(event.target.value, MAX_NAME_LENGTH))} /></label>
                      <label>Licence FFE<input aria-label={`Licence FFE du combattant ${index + 1}`} maxLength={MAX_NAME_LENGTH} value={fighter.licenseNumber} onChange={(event) => updateFighter(fighter.id, 'licenseNumber', normalizeSingleLine(event.target.value, MAX_NAME_LENGTH))} /></label>
                      <label className="participant-checkbox"><input type="checkbox" checked={fighter.captain} onChange={(event) => updateFighter(fighter.id, 'captain', event.target.checked)} /> Capitaine</label>
                    </div>
                  </details>
                </div>
              ))}
            </div>
            <button className="text-button add-fighter" type="button" disabled={draft.fighters.length >= MAX_FIGHTERS} onClick={addFighter}><span aria-hidden="true">＋</span> Ajouter un combattant</button>
            <p className="hint">Les noms restent modifiables directement dans la liste.</p>
          </section>

          <section className="panel assistants-panel" data-tour="assistants">
            <div className="section-heading">
              <div><p className="eyebrow">ÉQUIPE</p><h2>Assistants / Figurants</h2></div>
              <span className="count-badge">{draft.assistants.length}</span>
            </div>
            <div className="assistant-list">
              {draft.assistants.map((assistant, index) => (
                <details className="assistant-card participant-details" key={assistant.id}>
                  <summary aria-label={`Fiche de l’assistant ${index + 1}`}>{[assistant.firstName, assistant.lastName].filter(Boolean).join(' ') || `Assistant ${index + 1}`}</summary>
                  <div className="participant-fields">
                    <label>Prénom<input aria-label={`Prénom de l’assistant ${index + 1}`} maxLength={MAX_NAME_LENGTH} value={assistant.firstName} onChange={(event) => updateAssistant(assistant.id, 'firstName', event.target.value)} /></label>
                    <label>Nom<input aria-label={`Nom de famille de l’assistant ${index + 1}`} maxLength={MAX_NAME_LENGTH} value={assistant.lastName} onChange={(event) => updateAssistant(assistant.id, 'lastName', event.target.value)} /></label>
                    <label>Licence FFE<input aria-label={`Licence FFE de l’assistant ${index + 1}`} maxLength={MAX_NAME_LENGTH} value={assistant.licenseNumber} onChange={(event) => updateAssistant(assistant.id, 'licenseNumber', event.target.value)} /></label>
                    <label>Rôle<input aria-label={`Rôle de l’assistant ${index + 1}`} maxLength={MAX_NAME_LENGTH} placeholder="Narrateur, figurant…" value={assistant.role} onChange={(event) => updateAssistant(assistant.id, 'role', event.target.value)} /></label>
                    <button className="text-button remove-assistant" type="button" onClick={() => removeAssistant(assistant.id)}>Supprimer cet assistant</button>
                  </div>
                </details>
              ))}
            </div>
            <button className="text-button add-fighter" type="button" disabled={draft.assistants.length >= MAX_ASSISTANTS} onClick={addAssistant}><span aria-hidden="true">＋</span> Ajouter un assistant</button>
            {draft.assistants.length > 0 && <p className="hint">Les assistants ne sont pas proposés dans les lignes d’action.</p>}
          </section>

          <section className="panel movements-panel" data-tour="movements">
            <div className="section-heading">
              <div><p className="eyebrow">LEXIQUE SL</p><h2>Mouvements</h2></div>
              <span className="count-badge">{movementList.length}</span>
            </div>
            <p className="hint movement-hint">Cliquez sur un mouvement pour afficher sa description.</p>
            <ul className="movement-list">
              {movementList.map((movement) => {
                const isOpen = openDescription === movement.nom;
                return (
                  <li className={`movement-item${isOpen ? ' is-open' : ''}`} key={movement.nom} onPointerLeave={() => setOpenDescription(null)}>
                    <button type="button" className={`movement-name category-${movement.categorie}`} aria-expanded={isOpen} onClick={() => setOpenDescription(isOpen ? null : movement.nom)} onKeyDown={(event) => { if (event.key === 'Escape') setOpenDescription(null); }}>
                      <span className="movement-category-icon" aria-hidden="true">
                        {movement.categorie === 'main' ? (
                          <img src="/resources/icons/hand.svg" alt="" />
                        ) : movement.categorie === 'pieds' ? (
                          <img src="/resources/icons/foot.svg" alt="" />
                        ) : (
                          <><img src="/resources/icons/hand.svg" alt="" /><img src="/resources/icons/foot.svg" alt="" /></>
                        )}
                      </span>
                      <span className="sr-only">{movement.categorie === 'main' ? 'Mouvement de main : ' : movement.categorie === 'pieds' ? 'Mouvement de pieds : ' : 'Mouvement combiné : '}</span>
                      {movement.nom}<span className="movement-chevron" aria-hidden="true">{isOpen ? '−' : '+'}</span>
                    </button>
                    {isOpen && <div className="movement-description" role="tooltip">{movement.description}</div>}
                  </li>
                );
              })}
            </ul>
            <p className="hint lexicon-footnote">Lexique de départ non exhaustif.</p>
          </section>
        </aside>

        <section className="editor" aria-labelledby="project-title">
          <div className="editor-heading" data-tour="editor">
            <div>
              <p className="eyebrow">VOTRE SÉQUENCE</p>
              <h2 id="project-title">Projet chorégraphique</h2>
              <p className="subtitle">Composez le rythme, les intentions et les échanges de votre duel.</p>
            </div>
            <div className="autosave" data-tour="autosave"><span className="save-dot" aria-hidden="true" /> Brouillon local</div>
          </div>

          <section className="project-info" data-tour="project-info" aria-labelledby="project-info-title">
            <div className="section-heading">
              <div><p className="eyebrow">DOSSIER</p><h2 id="project-info-title">Informations générales</h2></div>
              <span className="project-category">{projectCategory}</span>
            </div>
            <div className="project-info-grid">
              <label>Titre de la chorégraphie<input aria-label="Titre de la chorégraphie" maxLength={MAX_NAME_LENGTH} value={draft.info.title} onChange={(event) => updateProjectInfo('title', normalizeSingleLine(event.target.value, MAX_NAME_LENGTH))} /></label>
              <label>Club<input aria-label="Club" maxLength={MAX_NAME_LENGTH} value={draft.info.club} onChange={(event) => updateProjectInfo('club', normalizeSingleLine(event.target.value, MAX_NAME_LENGTH))} /></label>
              <label>Durée<input aria-label="Durée" maxLength={MAX_DURATION_LENGTH} placeholder="00m:00s" value={draft.info.duration} onChange={(event) => updateProjectInfo('duration', normalizeSingleLine(event.target.value, MAX_DURATION_LENGTH))} /></label>
              <label className="opposition-duration">Durée d’opposition
                <span className="duration-control">
                  <input aria-label="Durée d’opposition" maxLength={MAX_DURATION_LENGTH} placeholder="00m:00s" value={draft.info.oppositionDuration} onChange={(event) => updateProjectInfo('oppositionDuration', normalizeSingleLine(event.target.value, MAX_DURATION_LENGTH))} />
                  <button className="icon-button calculate-duration" type="button" aria-label="Calculer la durée d’opposition" title="Calculer la durée d’opposition" onClick={calculateOppositionTime}>
                    <img src="/resources/icons/calculator.svg" alt="" aria-hidden="true" />
                  </button>
                </span>
              </label>
              <label className="ensemble-toggle"><input type="checkbox" checked={draft.info.ensemble} onChange={(event) => updateProjectInfo('ensemble', event.target.checked)} /> Mouvement d’ensemble</label>
            </div>
            <label className="project-notes">Informations : intrigue, musiques…<textarea aria-label="Informations : intrigue, musiques" maxLength={MAX_PROJECT_INFO_LENGTH} rows={3} value={draft.info.notes} onChange={(event) => updateProjectInfo('notes', normalizeMultiLine(event.target.value, MAX_PROJECT_INFO_LENGTH))} /></label>
            <p className="hint">Ces informations restent dans le brouillon local et figurent dans les exports PDF et JSON.</p>
          </section>

          <div className="notation-guide" aria-hidden="true">
            <span>ATTAQUANT</span><span>MOUVEMENT DE MAIN</span><span>MOUVEMENT DE PIEDS</span><span>INTENTION / DÉTAIL</span><span>DÉFENSEUR</span>
          </div>
          <div className="phrases-list">
            {draft.sections.map((section, sectionIndex) => {
              const start = sectionStart(draft.sections, sectionIndex);
              if (section.type === 'temps') {
                const timeNumber = draft.sections.slice(0, sectionIndex + 1).filter((item) => item.type === 'temps').length;
                const timeName = `Temps chorégraphique ${timeNumber}`;
                return <section className="phrase-group time-group" key={section.id} data-tour={timeNumber === 1 ? 'times' : undefined} onDragOver={(event) => { if (event.dataTransfer.types.includes('application/x-section')) event.preventDefault(); }} onDrop={(event) => handleSectionDrop(event, section.id)}>
                  <div className="phrase-rail"><h3 draggable onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('application/x-section', section.id); }}>{timeName}</h3><div className="phrase-timing"><span>Début</span><span>{formatTiming(start)}</span></div>
                    <label className="phrase-timing" htmlFor={`time-end-${section.id}`}><span>Fin</span><input id={`time-end-${section.id}`} aria-label={`Fin de ${timeName}`} type="number" min={start} step="0.1" value={timingEdits[section.id] ?? formatTiming(section.end)} onFocus={() => setTimingEdits((edits) => ({ ...edits, [section.id]: formatTiming(section.end) }))} onChange={(event) => { const value = event.target.value; setTimingEdits((edits) => ({ ...edits, [section.id]: value })); commitSectionEnd(sectionIndex, value, false); }} onBlur={() => commitSectionEnd(sectionIndex)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); commitSectionEnd(sectionIndex); } if (event.key === 'Escape') setTimingEdits(({ [section.id]: _discarded, ...edits }) => edits); }} /></label>
                    <div className="section-order"><button className="icon-button" type="button" aria-label={`Monter ${timeName}`} disabled={sectionIndex === 0} onClick={() => moveSection(section.id, -1)}>↑</button><button className="icon-button" type="button" aria-label={`Descendre ${timeName}`} disabled={sectionIndex === draft.sections.length - 1} onClick={() => moveSection(section.id, 1)}>↓</button></div>
                    <button className="text-button delete-phrase" type="button" aria-label={`Supprimer ${timeName}`} onClick={() => removeChoreographicTime(section.id)}>Supprimer</button></div>
                  <div className="time-placeholder">Ce temps ne contient pas de ligne d’action et ne compte pas dans le temps de combat.</div>
                </section>;
              }
              const phrase = section;
              const phraseIndex = phraseSections(draft.sections.slice(0, sectionIndex + 1)).length - 1;
              const phraseName = `Phrase d’armes ${phraseIndex + 1}`;
              return (
                <section className="phrase-group" key={phrase.id} aria-labelledby={`phrase-title-${phrase.id}`} data-tour={phraseIndex === 0 ? 'phrases' : undefined} onDragOver={(event) => { if (event.dataTransfer.types.includes('application/x-section')) event.preventDefault(); }} onDrop={(event) => handleSectionDrop(event, phrase.id)}>
                  <div className="phrase-rail">
                    <h3 id={`phrase-title-${phrase.id}`} tabIndex={-1} data-phrase-focus={phrase.id} draggable onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('application/x-section', phrase.id); }}>{phraseName}</h3>
                    <div className="phrase-timing"><span>Début</span><span>{formatTiming(start)}</span></div>
                    <label className="phrase-timing" htmlFor={`phrase-end-${phrase.id}`}><span>Fin</span>
                      <input
                        id={`phrase-end-${phrase.id}`}
                        aria-label={`Fin de ${phraseName}`}
                        type="number"
                        min={start}
                        step="0.1"
                        value={timingEdits[phrase.id] ?? formatTiming(phrase.end)}
                        onFocus={() => setTimingEdits((edits) => ({ ...edits, [phrase.id]: formatTiming(phrase.end) }))}
                        onChange={(event) => {
                          const value = event.target.value;
                          setTimingEdits((edits) => ({ ...edits, [phrase.id]: value }));
                          commitSectionEnd(sectionIndex, value, false);
                        }}
                        onBlur={() => commitSectionEnd(sectionIndex)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') { event.preventDefault(); commitSectionEnd(sectionIndex); }
                          if (event.key === 'Escape') setTimingEdits(({ [phrase.id]: _discarded, ...edits }) => edits);
                        }}
                      />
                    </label>
                    <button
                      className="text-button delete-phrase"
                      type="button"
                      aria-label={`Supprimer ${phraseName}`}
                      title={phrases.length === 1 ? 'Le projet doit conserver au moins une phrase d’armes.' : undefined}
                      disabled={phrases.length === 1}
                      onClick={() => removePhrase(phrase.id)}
                    >
                      <span aria-hidden="true">×</span> Supprimer
                    </button>
                    <div className="section-order"><button className="icon-button" type="button" aria-label={`Monter ${phraseName}`} disabled={sectionIndex === 0} onClick={() => moveSection(phrase.id, -1)}>↑</button><button className="icon-button" type="button" aria-label={`Descendre ${phraseName}`} disabled={sectionIndex === draft.sections.length - 1} onClick={() => moveSection(phrase.id, 1)}>↓</button></div>
                  </div>
                  <div
                    className={`phrase-lines${phrase.lines.length === 0 && dropTarget === `${phrase.id}:empty` ? ' is-drop-target' : ''}`}
                    onDragOver={(event) => { if (phrase.lines.length === 0) { event.preventDefault(); setDropTarget(`${phrase.id}:empty`); } }}
                    onDragLeave={() => setDropTarget(null)}
                    onDrop={(event) => { if (phrase.lines.length === 0) handleEmptyPhraseDrop(event, phraseIndex); }}
                  >
                    {phrase.lines.map((line, lineIndex) => {
                      const lineNumber = `${phraseIndex + 1}.${lineIndex + 1}`;
                      const beforeTarget = dropTarget === `${line.id}:before`;
                      const afterTarget = dropTarget === `${line.id}:after`;
                      const atFirst = lineIndex === 0 && phraseIndex === 0;
                      const atLast = lineIndex === phrase.lines.length - 1 && phraseIndex === phrases.length - 1;
                      return (
                        <div
                          className={`choreo-line${beforeTarget ? ' drop-before' : ''}${afterTarget ? ' drop-after' : ''}`}
                          key={line.id}
                          data-tour={phraseIndex === 0 && lineIndex === 0 ? 'lines' : undefined}
                          onDragOver={(event) => {
                            event.preventDefault();
                            const rect = event.currentTarget.getBoundingClientRect();
                            const after = event.clientY > rect.top + rect.height / 2;
                            setDropTarget(`${line.id}:${after ? 'after' : 'before'}`);
                          }}
                          onDragLeave={() => setDropTarget(null)}
                          onDrop={(event) => handleLineDrop(event, phraseIndex, line.id)}
                        >
                          <button className="line-number drag-handle" type="button" aria-label={`Faire glisser la ligne ${lineNumber} de ${phraseName}`} draggable onDragStart={(event) => handleLineDragStart(event, line.id)} onDragEnd={() => setDropTarget(null)}>{lineNumber}</button>
                          <AutocompleteInput id={`attacker-${line.id}`} label={`Attaquant, ligne ${lineNumber}`} value={line.attacker} suggestions={fighterSuggestions} placeholder="Choisir ou saisir" required maxLength={MAX_NAME_LENGTH} onChange={(value) => updateLine(line.id, 'attacker', value)} />
                          <AutocompleteInput id={`hand-movement-${line.id}`} label={`Mouvement de main, ligne ${lineNumber}`} value={line.handMovement} suggestions={handSuggestions} placeholder="Mouvement de main" maxLength={MAX_NAME_LENGTH} onChange={(value) => updateLine(line.id, 'handMovement', value)} />
                          {!(isCombinedMovement(line.handMovement) && !line.footMovement.trim()) && <AutocompleteInput id={`foot-movement-${line.id}`} label={`Mouvement de pieds, ligne ${lineNumber}`} value={line.footMovement} suggestions={footSuggestions} placeholder="Mouvement de pieds" maxLength={MAX_NAME_LENGTH} onChange={(value) => updateLine(line.id, 'footMovement', value)} />}
                          <AutocompleteInput id={`details-${line.id}`} className="details-autocomplete" label={`Détail libre, ligne ${lineNumber}`} value={line.details} suggestions={getCharacteristics(line.handMovement, line.footMovement)} placeholder="Ajouter un détail…" maxLength={MAX_DETAILS_LENGTH} commaDelimited onChange={(value) => updateLine(line.id, 'details', value)} />
                          <div className="defender-group">
                            {line.defender.trim() && <span className="against-label">contre</span>}
                            <AutocompleteInput id={`defender-${line.id}`} label={`Défenseur facultatif, ligne ${lineNumber}`} value={line.defender} suggestions={fighterSuggestions} placeholder="Défenseur" maxLength={MAX_NAME_LENGTH} onChange={(value) => updateLine(line.id, 'defender', value)} onBlur={(value) => handleDefenderBlur(line.id, value)} />
                          </div>
                          {line.defender.trim() && (
                            <div className="defender-reaction">
                              <span className="reaction-intro">qui</span>
                              <AutocompleteInput id={`defender-movement-${line.id}`} label={`Mouvement de réaction du défenseur, ligne ${lineNumber}`} value={line.defenderMovement} suggestions={movementSuggestions} placeholder="Mouvement de réaction" maxLength={MAX_NAME_LENGTH} onChange={(value) => updateLine(line.id, 'defenderMovement', value)} />
                              <AutocompleteInput id={`defender-details-${line.id}`} className="details-autocomplete" label={`Détail de réaction du défenseur, ligne ${lineNumber}`} value={line.defenderDetails} suggestions={getCharacteristics(line.defenderMovement)} placeholder="Détail / intention" maxLength={MAX_DETAILS_LENGTH} commaDelimited onChange={(value) => updateLine(line.id, 'defenderDetails', value)} />
                            </div>
                          )}
                          <div className="line-actions">
                            <button className="icon-button move-line" type="button" aria-label={`Monter la ligne ${lineNumber}`} disabled={atFirst} onClick={() => moveLineAdjacent(line.id, -1)}>↑</button>
                            <button className="icon-button move-line" type="button" aria-label={`Descendre la ligne ${lineNumber}`} disabled={atLast} onClick={() => moveLineAdjacent(line.id, 1)}>↓</button>
                            <button className="icon-button add-line" type="button" aria-label={`Ajouter une ligne après ${lineNumber}`} disabled={lineCount >= MAX_LINES} onClick={() => addLine(phrase.id, line.id)}>＋</button>
                            <button className="icon-button delete-line" type="button" aria-label={`Supprimer la ligne ${lineNumber}`} onClick={() => removeLine(line.id)}>×</button>
                          </div>
                        </div>
                      );
                    })}
                    {phrase.lines.length === 0 && <div className="empty-phrase" data-tour={phraseIndex === 0 ? 'lines' : undefined}><p>Déposez une ligne ici ou ajoutez-en une.</p><button className="button button-muted" type="button" disabled={lineCount >= MAX_LINES} onClick={() => addLine(phrase.id)}>Ajouter la première ligne</button></div>}
                  </div>
                </section>
              );
            })}
          </div>
          <button className="button button-muted add-phrase" type="button" onClick={addPhrase}><span aria-hidden="true">＋</span> Ajouter une Phrase d’armes</button>
          <button className="button button-muted add-phrase" type="button" data-tour="times" onClick={addChoreographicTime}><span aria-hidden="true">＋</span> Ajouter un Temps chorégraphique</button>
          {exportError && <p className="validation-message" role="alert">{exportError}</p>}
          <div className="editor-footer">
            <span><kbd>＋</kbd> ajoute une ligne à la suite</span>
            <span>{lineCount} {lineCount > 1 ? 'lignes' : 'ligne'} · {phrases.length} phrases · {draft.sections.filter((section) => section.type === 'temps').length} temps</span>
          </div>
        </section>
      </div>

      <footer className="page-footer"><span>FORGE CHORÉGRAPHIQUE <span aria-hidden="true">·</span> V0</span><span>Votre projet est conservé uniquement dans ce navigateur.</span></footer>
      {tourOpen && <GuidedTour onClose={() => setTourOpen(false)} />}
      <dialog ref={pdfDialogRef} className="pdf-dialog" aria-labelledby="pdf-dialog-title" onClose={() => setPdfDialogOpen(false)} onCancel={() => setPdfDialogOpen(false)}>
        <form onSubmit={(event) => { event.preventDefault(); void exportPdf(); }}>
          <p className="eyebrow">EXPORT PDF</p>
          <h2 id="pdf-dialog-title">Format ASL-FFE</h2>
          <label htmlFor="pdf-format">Format de page</label>
          <select id="pdf-format" value={pdfFormat} onChange={(event) => setPdfFormat(event.target.value)}>
            <option value="A4-landscape">A4 paysage</option><option value="A4-portrait">A4 portrait</option>
            <option value="A3-landscape">A3 paysage</option><option value="A3-portrait">A3 portrait</option>
          </select>
          <div className="pdf-dialog-actions"><button className="button button-muted" type="button" onClick={() => setPdfDialogOpen(false)}>Annuler</button><button className="button button-primary" type="submit">Télécharger le PDF</button></div>
        </form>
      </dialog>
    </main>
  );
}
