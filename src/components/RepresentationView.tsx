import { useEffect, useRef, useState } from 'react';
import { formatChoreographyLine, hasStartedLine, type ProjectDraft } from '../lib/project';
import { getRepresentationFocus, getRepresentationThreshold } from '../lib/representation';

type Props = { project: Readonly<ProjectDraft>; initialElapsedMs: number; onBack: (elapsedMs: number) => void };
const sectionStart = (project: ProjectDraft, index: number) => index ? project.sections[index - 1].end : 0;
const formatSectionTime = (seconds: number) => Number.isInteger(seconds) ? seconds.toFixed(1) : String(seconds);

export default function RepresentationView({ project, initialElapsedMs, onBack }: Props) {
  const [elapsedMs, setElapsedMs] = useState(initialElapsedMs);
  const [running, setRunning] = useState(false);
  const [started, setStarted] = useState(initialElapsedMs > 0);
  const elapsedRef = useRef(initialElapsedMs);
  const runStartRef = useRef(0);
  const elapsedSeconds = elapsedMs / 1000;
  const focus = started ? getRepresentationFocus(project, elapsedSeconds) : null;
  const threshold = getRepresentationThreshold(project);
  const exceeded = threshold !== null && elapsedSeconds >= threshold.seconds;
  const actions = project.sections.flatMap((section) => section.type === 'phrase' ? section.lines.filter(hasStartedLine) : []);
  const actionIndices = new Map(actions.map((line, index) => [line.id, index]));

  useEffect(() => {
    if (!running) return;
    let frame = 0;
    let lastPaint = 0;
    const tick = (now: number) => {
      const nextElapsed = Math.max(0, now - runStartRef.current);
      elapsedRef.current = nextElapsed;
      if (now - lastPaint >= 100) {
        setElapsedMs(nextElapsed);
        lastPaint = now;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running]);

  const focusKey = focus ? `${focus.sectionId}:${focus.lineId ?? ''}` : '';
  useEffect(() => {
    if (!focusKey) return;
    const targetId = focus?.lineId ? `representation-line-${focus.lineId}` : `representation-section-${focus?.sectionId}`;
    document.getElementById(targetId)?.scrollIntoView?.({ behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'center' });
  }, [focusKey]);

  function start() {
    runStartRef.current = performance.now() - elapsedRef.current;
    setStarted(true);
    setRunning(true);
  }

  function pause() {
    const value = Math.max(0, performance.now() - runStartRef.current);
    elapsedRef.current = value;
    setElapsedMs(value);
    setRunning(false);
  }

  function reset() {
    elapsedRef.current = 0;
    setElapsedMs(0);
    setRunning(false);
    setStarted(false);
  }

  function leave() {
    const value = running ? Math.max(0, performance.now() - runStartRef.current) : elapsedRef.current;
    setRunning(false);
    onBack(value);
  }

  const minutes = Math.floor(elapsedMs / 60000);
  const seconds = Math.floor((elapsedMs % 60000) / 1000);
  const tenth = Math.floor((elapsedMs % 1000) / 100);

  return <main className="representation-shell">
    <header className="representation-header"><div><p className="eyebrow">LECTURE DU PROJET</p><h1>Vue Représentation</h1>{project.info.title.trim() && <p className="representation-title">{project.info.title}</p>}</div>
      <button className="button button-muted" type="button" onClick={leave}>Retour à l’éditeur</button>
    </header>
    <section className={`representation-clock${started ? ' is-compact' : ''}${exceeded ? ' is-overtime' : ''}`} aria-label="Chronomètre de représentation">
      <div className="clock-readout" role="timer" aria-live="off" aria-label="Temps écoulé">{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}<span>.{tenth}</span></div>
      <div className="clock-controls">{running
        ? <button className="button button-primary" type="button" onClick={pause}>Pause</button>
        : <button className="button button-primary" type="button" onClick={start}>{started ? 'Reprendre' : 'Lancer'}</button>}
        <button className="button button-muted" type="button" onClick={reset} disabled={!started && elapsedMs === 0}>Réinitialiser</button>
      </div>
      <p className="clock-status" role="status">{exceeded ? 'Durée prévue dépassée — le chronomètre continue.' : threshold?.source === 'timeline' ? 'Durée générale absente, nulle ou invalide : seuil basé sur la fin de la chronologie.' : threshold ? `Durée prévue : ${formatSectionTime(threshold.seconds)} s` : 'Aucune durée exploitable : le chronomètre fonctionne sans seuil.'}</p>
      {started && (project.sections.at(-1)?.end ?? 0) > 0 && elapsedSeconds >= (project.sections.at(-1)?.end ?? 0) && <p className="timeline-complete">Chronologie terminée</p>}
    </section>

    <p className="sr-only" aria-live="polite" aria-atomic="true">{focus ? focus.sectionType === 'phrase' ? `Phrase d’armes ${focus.sectionNumber}${focus.lineNumber ? `, action ${focus.lineNumber}` : ''}` : `Temps chorégraphique ${focus.sectionNumber}` : started && (project.sections.at(-1)?.end ?? 0) > 0 && elapsedSeconds >= (project.sections.at(-1)?.end ?? 0) ? 'Chronologie terminée' : ''}</p>
    <div className="representation-project" aria-label="Projet chorégraphique en lecture seule">
      {project.sections.map((section, sectionIndex) => {
        const startAt = sectionStart(project, sectionIndex);
        const activeSection = focus?.sectionId === section.id;
        const sectionName = section.type === 'phrase'
          ? `Phrase d’armes ${project.sections.slice(0, sectionIndex + 1).filter((item) => item.type === 'phrase').length}`
          : `Temps chorégraphique ${project.sections.slice(0, sectionIndex + 1).filter((item) => item.type === 'temps').length}`;
        return <section className={`representation-section${activeSection ? ' is-active' : ''}`} id={`representation-section-${section.id}`} key={section.id}>
          <header className="representation-section-heading"><h2>{sectionName}</h2><span>{formatSectionTime(startAt)} – {formatSectionTime(section.end)}</span></header>
          {section.type === 'temps' ? <p className={`representation-time-label${activeSection ? ' is-current' : ''}`}>Temps sans action de combat</p> : section.lines.map((line, lineIndex) => {
            const actionIndex = actionIndices.get(line.id);
            const distance = actionIndex !== undefined && focus?.lineId ? Math.abs(actionIndex - (actionIndices.get(focus.lineId) ?? actionIndex)) : 0;
            const emphasis = actionIndex !== undefined && focus?.lineId === line.id ? ' is-current' : distance === 1 ? ' is-neighbor-1' : distance === 2 ? ' is-neighbor-2' : '';
            const text = hasStartedLine(line) ? `${formatChoreographyLine(line)}` : 'Ligne à compléter';
            return <p className={`representation-line${emphasis}`} id={`representation-line-${line.id}`} key={line.id}><span className="representation-line-number">{sectionName.replace('Phrase d’armes ', '')}.{lineIndex + 1}</span>{text}</p>;
          })}
        </section>;
      })}
    </div>
  </main>;
}
