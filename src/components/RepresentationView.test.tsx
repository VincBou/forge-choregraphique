import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import RepresentationView from './RepresentationView';
import { defaultDraft } from '../lib/project';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('RepresentationView', () => {
  it('pauses and returns the elapsed time while showing the project as read-only', () => {
    const project = defaultDraft();
    const phrase = project.sections[0];
    if (phrase.type !== 'phrase') throw new Error('Default phrase missing');
    phrase.end = 20;
    phrase.lines[0] = { ...phrase.lines[0], attacker: 'Combattant A', handMovement: 'Attaque' };
    let now = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const onBack = vi.fn();
    const { container } = render(<RepresentationView project={project} initialElapsedMs={0} onBack={onBack} />);

    expect(screen.getByText(/Combattant A Attaque/)).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Lancer' }));
    now = 7100;
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(screen.getByRole('timer')).toHaveTextContent('00:06.1');
    expect(container.querySelector('.representation-clock')).toHaveClass('is-compact');
    fireEvent.click(screen.getByRole('button', { name: 'Retour à l’éditeur' }));
    expect(onBack).toHaveBeenCalledWith(6100);
  });

  it('marks overtime in red while keeping pause and reset controls available', () => {
    const project = defaultDraft();
    project.info.duration = '00m:02s';
    let now = 500;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const { container } = render(<RepresentationView project={project} initialElapsedMs={0} onBack={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Lancer' }));
    now = 2700;
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(container.querySelector('.representation-clock')).toHaveClass('is-overtime');
    expect(screen.getByRole('status')).toHaveTextContent(/Durée prévue dépassée/);
    fireEvent.click(screen.getByRole('button', { name: 'Réinitialiser' }));
    expect(screen.getByRole('timer')).toHaveTextContent('00:00.0');
    expect(screen.getByRole('button', { name: 'Lancer' })).toBeInTheDocument();
  });
});
