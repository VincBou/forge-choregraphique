import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import movementData from './data/mouvements.json';
import AutocompleteInput from './components/AutocompleteInput';
import {
  createLineId,
  defaultDraft,
  formatProject,
  getExportError,
  loadDraft,
  LEGACY_STORAGE_KEY,
  OLDER_STORAGE_KEY,
  PREVIOUS_STORAGE_KEY,
  MAX_DETAILS_LENGTH,
  MAX_FIGHTERS,
  MAX_LINES,
  MAX_NAME_LENGTH,
  normalizeSearch,
  normalizeSingleLine,
  STORAGE_KEY,
  type ChoreographyLine,
  type MovementCategory,
} from './lib/project';

type Movement = { nom: string; description: string; categorie: MovementCategory };
function isMovementList(value: unknown): value is Movement[] {
  return Array.isArray(value) && value.length <= 1000 && value.every((item) =>
    !!item && typeof item === 'object'
    && typeof (item as Movement).nom === 'string'
    && (item as Movement).nom.trim().length > 0
    && (item as Movement).nom.length <= 100
    && typeof (item as Movement).description === 'string'
    && (item as Movement).description.length <= 1000
    && ['main', 'pieds', 'combine'].includes((item as Movement).categorie));
}

const movementList = isMovementList(movementData) ? movementData : [];
const combinedMovementNames = new Set(movementList.filter((movement) => movement.categorie === 'combine').map((movement) => normalizeSearch(movement.nom)));
const isCombinedMovement = (value: string) => combinedMovementNames.has(normalizeSearch(value.trim()));
const movementCategories = new Map(movementList.map((movement) => [normalizeSearch(movement.nom), movement.categorie]));
const initialState = loadDraft(undefined, movementCategories);
const createEmptyLine = (): ChoreographyLine => ({ id: createLineId(), attacker: '', handMovement: '', footMovement: '', details: '', defender: '', defenderMovement: '', defenderDetails: '' });
const phraseStart = (phrases: typeof initialState.draft.phrases, index: number) => index === 0 ? 0 : phrases[index - 1].end;
const formatTiming = (value: number) => Number.isInteger(value) ? value.toFixed(1) : String(value);

export default function App() {
  const [draft, setDraft] = useState(initialState.draft);
  const [notice, setNotice] = useState(initialState.warning);
  const [exportError, setExportError] = useState<string | null>(null);
  const [openDescription, setOpenDescription] = useState<string | null>(null);
  const [fighterEdits, setFighterEdits] = useState<Record<number, string>>({});
  const [timingEdits, setTimingEdits] = useState<Record<string, string>>({});
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const hasEdited = useRef(false);
  const fighterSuggestions = useMemo(() => draft.fighters.filter(Boolean), [draft.fighters]);
  const movementSuggestions = useMemo(() => movementList.map((movement) => movement.nom), []);
  const handSuggestions = useMemo(() => movementList.filter((movement) => movement.categorie === 'main' || movement.categorie === 'combine').map((movement) => movement.nom), []);
  const footSuggestions = useMemo(() => movementList.filter((movement) => movement.categorie === 'pieds').map((movement) => movement.nom), []);

  useEffect(() => {
    if (!hasEdited.current) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    } catch {
      setNotice('Impossible d’enregistrer le brouillon dans ce navigateur. Téléchargez le projet pour le conserver.');
    }
  }, [draft]);

  function changeDraft(nextDraft: typeof draft) {
    hasEdited.current = true;
    setDraft(nextDraft);
    setNotice(null);
  }

  function updateFighterEdit(index: number, value: string) {
    setFighterEdits((edits) => ({ ...edits, [index]: value }));
  }

  function commitFighterEdit(index: number) {
    const editedName = fighterEdits[index];
    if (editedName === undefined) return;

    const newName = normalizeSingleLine(editedName, MAX_NAME_LENGTH);
    const oldName = draft.fighters[index];
    setFighterEdits(({ [index]: _discarded, ...edits }) => edits);

    if (!newName.trim() || oldName === newName) return;

    const fighters = [...draft.fighters];
    fighters[index] = newName;
    const phrases = oldName ? draft.phrases.map((phrase) => ({
      ...phrase,
      lines: phrase.lines.map((line) => ({
        ...line,
        attacker: line.attacker === oldName ? newName : line.attacker,
        defender: line.defender === oldName ? newName : line.defender,
      })),
    })) : draft.phrases;
    changeDraft({ ...draft, fighters, phrases });
  }

  function addFighter() {
    if (draft.fighters.length < MAX_FIGHTERS) changeDraft({ ...draft, fighters: [...draft.fighters, ''] });
  }

  function removeFighter(index: number) {
    changeDraft({ ...draft, fighters: draft.fighters.filter((_, fighterIndex) => fighterIndex !== index) });
  }

  function updateLine(id: string, field: keyof Omit<ChoreographyLine, 'id'>, value: string) {
    const limit = field === 'details' ? MAX_DETAILS_LENGTH : MAX_NAME_LENGTH;
    const normalized = normalizeSingleLine(value, limit);
    changeDraft({ ...draft, phrases: draft.phrases.map((phrase) => ({
      ...phrase,
      lines: phrase.lines.map((line) => line.id === id
        ? { ...line, [field]: normalized, ...(field === 'handMovement' && isCombinedMovement(normalized) ? { footMovement: '' } : {}) }
        : line),
    })) });
    setExportError(null);
  }

  function addLine(phraseId: string, afterId?: string) {
    const lineCount = draft.phrases.reduce((count, phrase) => count + phrase.lines.length, 0);
    if (lineCount >= MAX_LINES) return;
    const phrases = draft.phrases.map((phrase) => {
      if (phrase.id !== phraseId) return phrase;
      const lines = [...phrase.lines];
      const index = afterId ? lines.findIndex((line) => line.id === afterId) : lines.length - 1;
      lines.splice(index + 1, 0, createEmptyLine());
      return { ...phrase, lines };
    });
    changeDraft({ ...draft, phrases });
    setExportError(null);
  }

  function addPhrase() {
    const end = draft.phrases.at(-1)?.end ?? 0;
    changeDraft({ ...draft, phrases: [...draft.phrases, { id: createLineId(), end, lines: [] }] });
    setExportError(null);
  }

  function removeLine(id: string) {
    changeDraft({ ...draft, phrases: draft.phrases.map((phrase) => ({
      ...phrase,
      lines: phrase.lines.filter((line) => line.id !== id),
    })) });
    setExportError(null);
  }

  function moveLineTo(lineId: string, targetPhraseIndex: number, targetLineId?: string, after = false) {
    if (!draft.phrases[targetPhraseIndex]) return;
    const phrases = draft.phrases.map((phrase) => ({ ...phrase, lines: [...phrase.lines] }));
    const sourcePhraseIndex = phrases.findIndex((phrase) => phrase.lines.some((line) => line.id === lineId));
    if (sourcePhraseIndex < 0 || (targetLineId && targetLineId === lineId)) return;
    const sourceLines = phrases[sourcePhraseIndex].lines;
    const sourceIndex = sourceLines.findIndex((line) => line.id === lineId);
    const [line] = sourceLines.splice(sourceIndex, 1);
    const targetLines = phrases[targetPhraseIndex].lines;
    const targetIndex = targetLineId ? targetLines.findIndex((candidate) => candidate.id === targetLineId) : targetLines.length;
    targetLines.splice(Math.max(0, targetIndex + (after ? 1 : 0)), 0, line);
    changeDraft({ ...draft, phrases });
    setDropTarget(null);
    setExportError(null);
  }

  function moveLineAdjacent(lineId: string, direction: -1 | 1) {
    const phraseIndex = draft.phrases.findIndex((phrase) => phrase.lines.some((line) => line.id === lineId));
    if (phraseIndex < 0) return;
    const lines = draft.phrases[phraseIndex].lines;
    const lineIndex = lines.findIndex((line) => line.id === lineId);
    if (direction < 0) {
      if (lineIndex > 0) moveLineTo(lineId, phraseIndex, lines[lineIndex - 1].id);
      else if (phraseIndex > 0) moveLineTo(lineId, phraseIndex - 1);
    } else if (lineIndex < lines.length - 1) {
      moveLineTo(lineId, phraseIndex, lines[lineIndex + 1].id, true);
    } else if (phraseIndex < draft.phrases.length - 1) {
      moveLineTo(lineId, phraseIndex + 1, draft.phrases[phraseIndex + 1].lines[0]?.id);
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

  function commitPhraseEnd(index: number) {
    const phrase = draft.phrases[index];
    const edited = timingEdits[phrase.id];
    if (edited === undefined) return;
    setTimingEdits(({ [phrase.id]: _discarded, ...edits }) => edits);
    if (!edited.trim()) return;
    const value = Number(edited);
    if (!Number.isFinite(value) || value < 0) return;

    const phrases = [...draft.phrases];
    phrases[index] = { ...phrase, end: Math.max(phraseStart(phrases, index), value) };
    for (let next = index + 1; next < phrases.length; next += 1) {
      const start = phrases[next - 1].end;
      if (phrases[next].end < start) phrases[next] = { ...phrases[next], end: start };
    }
    changeDraft({ ...draft, phrases });
  }

  function handleDefenderBlur(id: string, defender: string) {
    if (defender.trim()) return;
    const line = draft.phrases.flatMap((phrase) => phrase.lines).find((candidate) => candidate.id === id);
    if (!line || (!line.defenderMovement && !line.defenderDetails)) return;
    changeDraft({
      ...draft,
      phrases: draft.phrases.map((phrase) => ({
        ...phrase,
        lines: phrase.lines.map((candidate) => candidate.id === id
          ? { ...candidate, defenderMovement: '', defenderDetails: '' }
          : candidate),
      })),
    });
    setExportError(null);
  }

  function exportProject() {
    const error = getExportError(draft);
    if (error) { setExportError(error); return; }
    const file = new Blob([`\uFEFF${formatProject(draft)}`], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'projet-choregraphique.txt';
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setExportError(null);
  }

  function clearLocalProject() {
    if (!window.confirm('Effacer le projet enregistré dans ce navigateur ? Cette action ne peut pas être annulée.')) return;
    let cleared = false;
    try {
      window.localStorage.removeItem(STORAGE_KEY);
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

  const lineCount = draft.phrases.reduce((count, phrase) => count + phrase.lines.length, 0);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-mark" aria-hidden="true">✦</div>
        <div className="brand-copy">
          <p className="eyebrow">ATELIER DE CRÉATION CHORÉGRAPHIQUE · SABRE LASER</p>
          <h1>Forge Chorégraphique</h1>
        </div>
        <div className="topbar-actions">
          <button className="button button-muted" type="button" onClick={clearLocalProject}>Effacer le brouillon local</button>
          <button className="button button-primary" type="button" onClick={exportProject}><span aria-hidden="true">↓</span> Télécharger le projet</button>
        </div>
      </header>

      {(notice || !movementList.length) && <div className="notice" role="status">{notice ?? 'La liste des mouvements est indisponible.'}</div>}

      <div className="workspace">
        <aside className="sidebar" aria-label="Ressources du projet">
          <section className="panel fighters-panel">
            <div className="section-heading">
              <div><p className="eyebrow">ÉQUIPE</p><h2>Combattants</h2></div>
              <span className="count-badge">{draft.fighters.length}</span>
            </div>
            <div className="fighter-list">
              {draft.fighters.map((fighter, index) => (
                <div className="fighter-row" key={`fighter-${index}`}>
                  <span className="fighter-dot" aria-hidden="true" />
                  <input
                    aria-label={`Nom du combattant ${index + 1}`}
                    value={fighterEdits[index] ?? fighter}
                    maxLength={MAX_NAME_LENGTH}
                    autoComplete="off"
                    placeholder={`Combattant ${String.fromCharCode(65 + (index % 26))}`}
                    onFocus={() => updateFighterEdit(index, fighter)}
                    onChange={(event) => updateFighterEdit(index, event.target.value)}
                    onBlur={() => commitFighterEdit(index)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        commitFighterEdit(index);
                      }
                    }}
                  />
                  <button className="icon-button remove-fighter" type="button" aria-label={`Supprimer le combattant ${index + 1}`} onClick={() => removeFighter(index)}>×</button>
                </div>
              ))}
            </div>
            <button className="text-button add-fighter" type="button" disabled={draft.fighters.length >= MAX_FIGHTERS} onClick={addFighter}><span aria-hidden="true">＋</span> Ajouter un combattant</button>
            <p className="hint">Les noms restent modifiables directement dans la liste.</p>
          </section>

          <section className="panel movements-panel">
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
          <div className="editor-heading">
            <div>
              <p className="eyebrow">VOTRE SÉQUENCE</p>
              <h2 id="project-title">Projet chorégraphique</h2>
              <p className="subtitle">Composez le rythme, les intentions et les échanges de votre duel.</p>
            </div>
            <div className="autosave"><span className="save-dot" aria-hidden="true" /> Brouillon local</div>
          </div>

          <div className="notation-guide" aria-hidden="true">
            <span>ATTAQUANT</span><span>MOUVEMENT DE MAIN</span><span>MOUVEMENT DE PIEDS</span><span>INTENTION / DÉTAIL</span><span>DÉFENSEUR</span>
          </div>
          <div className="phrases-list">
            {draft.phrases.map((phrase, phraseIndex) => {
              const start = phraseStart(draft.phrases, phraseIndex);
              const phraseName = `Phrase d’armes ${phraseIndex + 1}`;
              return (
                <section className="phrase-group" key={phrase.id} aria-labelledby={`phrase-title-${phrase.id}`}>
                  <div className="phrase-rail">
                    <h3 id={`phrase-title-${phrase.id}`}>{phraseName}</h3>
                    <div className="phrase-timing"><span>Début</span><span>{formatTiming(start)}</span></div>
                    <label className="phrase-timing" htmlFor={`phrase-end-${phrase.id}`}><span>Fin</span>
                      <input
                        id={`phrase-end-${phrase.id}`}
                        aria-label={`Fin de ${phraseName}`}
                        type="number"
                        min={start}
                        step="any"
                        value={timingEdits[phrase.id] ?? formatTiming(phrase.end)}
                        onFocus={() => setTimingEdits((edits) => ({ ...edits, [phrase.id]: formatTiming(phrase.end) }))}
                        onChange={(event) => setTimingEdits((edits) => ({ ...edits, [phrase.id]: event.target.value }))}
                        onBlur={() => commitPhraseEnd(phraseIndex)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') { event.preventDefault(); commitPhraseEnd(phraseIndex); }
                          if (event.key === 'Escape') setTimingEdits(({ [phrase.id]: _discarded, ...edits }) => edits);
                        }}
                      />
                    </label>
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
                      const atLast = lineIndex === phrase.lines.length - 1 && phraseIndex === draft.phrases.length - 1;
                      return (
                        <div
                          className={`choreo-line${beforeTarget ? ' drop-before' : ''}${afterTarget ? ' drop-after' : ''}`}
                          key={line.id}
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
                          <input className="details-input" aria-label={`Détail libre, ligne ${lineNumber}`} value={line.details} maxLength={MAX_DETAILS_LENGTH} autoComplete="off" placeholder="Ajouter un détail…" onChange={(event) => updateLine(line.id, 'details', event.target.value)} />
                          <div className="defender-group">
                            {line.defender.trim() && <span className="against-label">contre</span>}
                            <AutocompleteInput id={`defender-${line.id}`} label={`Défenseur facultatif, ligne ${lineNumber}`} value={line.defender} suggestions={fighterSuggestions} placeholder="Défenseur" maxLength={MAX_NAME_LENGTH} onChange={(value) => updateLine(line.id, 'defender', value)} onBlur={(value) => handleDefenderBlur(line.id, value)} />
                          </div>
                          {line.defender.trim() && (
                            <div className="defender-reaction">
                              <span className="reaction-intro">qui</span>
                              <AutocompleteInput id={`defender-movement-${line.id}`} label={`Mouvement de réaction du défenseur, ligne ${lineNumber}`} value={line.defenderMovement} suggestions={movementSuggestions} placeholder="Mouvement de réaction" maxLength={MAX_NAME_LENGTH} onChange={(value) => updateLine(line.id, 'defenderMovement', value)} />
                              <input className="details-input" aria-label={`Détail de réaction du défenseur, ligne ${lineNumber}`} value={line.defenderDetails} maxLength={MAX_DETAILS_LENGTH} autoComplete="off" placeholder="Détail / intention" onChange={(event) => updateLine(line.id, 'defenderDetails', event.target.value)} />
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
                    {phrase.lines.length === 0 && <div className="empty-phrase"><p>Déposez une ligne ici ou ajoutez-en une.</p><button className="button button-muted" type="button" disabled={lineCount >= MAX_LINES} onClick={() => addLine(phrase.id)}>Ajouter la première ligne</button></div>}
                  </div>
                </section>
              );
            })}
          </div>
          <button className="button button-muted add-phrase" type="button" onClick={addPhrase}><span aria-hidden="true">＋</span> Ajouter une Phrase d’armes</button>
          {exportError && <p className="validation-message" role="alert">{exportError}</p>}
          <div className="editor-footer">
            <span><kbd>＋</kbd> ajoute une ligne à la suite</span>
            <span>{lineCount} {lineCount > 1 ? 'lignes' : 'ligne'} · {draft.phrases.length} phrases</span>
          </div>
        </section>
      </div>

      <footer className="page-footer"><span>FORGE CHORÉGRAPHIQUE <span aria-hidden="true">·</span> V0</span><span>Votre projet est conservé uniquement dans ce navigateur.</span></footer>
    </main>
  );
}
