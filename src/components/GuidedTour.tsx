import { useLayoutEffect, useRef, useState, type SyntheticEvent } from 'react';
import tutorialSteps from '../data/tutoriel.json';

type Props = { onClose: () => void };
type TutorialStep = { id: string; title: string; text: string; textEmpty?: string };
type Spotlight = { top: number; left: number; width: number; height: number; centerY: number };
const steps = tutorialSteps as TutorialStep[];

export default function GuidedTour({ onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const targetRef = useRef<HTMLElement | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [spotlight, setSpotlight] = useState<Spotlight | null>(null);
  const step = steps[stepIndex];
  const description = step.id === 'lines' && targetRef.current?.classList.contains('empty-phrase')
    ? step.textEmpty ?? step.text
    : step.text;

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    if (!dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    }
    return () => {
      if (dialog.open) {
        if (typeof dialog.close === 'function') dialog.close();
        else dialog.removeAttribute('open');
      }
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useLayoutEffect(() => {
    const target = document.querySelector<HTMLElement>(`[data-tour="${step.id}"]`);
    targetRef.current = target;
    if (!target) {
      setSpotlight(null);
      return;
    }

    target.scrollIntoView?.({ behavior: 'smooth', block: step.id === 'editor' ? 'start' : 'center', inline: 'nearest' });
    const updateSpotlight = () => {
      const rect = target.getBoundingClientRect();
      const top = Math.max(4, rect.top - 5);
      const left = Math.max(4, rect.left - 5);
      const right = Math.min(window.innerWidth - 4, rect.right + 5);
      const bottom = Math.min(window.innerHeight - 4, rect.bottom + 5);
      setSpotlight({ top, left, width: Math.max(0, right - left), height: Math.max(0, bottom - top), centerY: (top + bottom) / 2 });
    };
    updateSpotlight();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateSpotlight);
    observer?.observe(target);
    window.addEventListener('resize', updateSpotlight);
    window.addEventListener('scroll', updateSpotlight, true);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updateSpotlight);
      window.removeEventListener('scroll', updateSpotlight, true);
    };
  }, [step.id]);

  function cancel(event: SyntheticEvent<HTMLDialogElement>) {
    event.preventDefault();
    onClose();
  }

  return (
    <dialog ref={dialogRef} className="tour-dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-description" onCancel={cancel}>
      {spotlight && <div aria-hidden="true" className="tour-spotlight" style={{ top: spotlight.top, left: spotlight.left, width: spotlight.width, height: spotlight.height }} />}
      <section className={`tour-card${spotlight && spotlight.centerY > window.innerHeight / 2 ? ' tour-card-top' : ''}`}>
        <div aria-live="polite" aria-atomic="true">
          <p className="eyebrow">ÉTAPE {stepIndex + 1} SUR {steps.length}</p>
          <h2 id="tour-title">{step.title}</h2>
          <p id="tour-description">{description}</p>
        </div>
        <div className="tour-actions">
          <button className="button button-muted" type="button" onClick={onClose}>Annuler</button>
          <button className="button button-primary" type="button" autoFocus onClick={() => stepIndex + 1 < steps.length ? setStepIndex(stepIndex + 1) : onClose()}>
            {stepIndex + 1 < steps.length ? 'Suivant' : 'Terminer'}
          </button>
        </div>
      </section>
    </dialog>
  );
}
