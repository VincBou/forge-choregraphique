import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import App from './App';

describe('App security and editor basics', () => {
  beforeEach(() => window.localStorage.clear());

  it('keeps entered HTML as inert input text', () => {
    const { container } = render(<App />);
    const payload = '<img src=x onerror=alert(1)>';
    fireEvent.change(screen.getByRole('textbox', { name: 'Nom du combattant 1' }), { target: { value: payload } });
    expect(screen.getByRole('textbox', { name: 'Nom du combattant 1' })).toHaveValue(payload);
    expect(container.querySelector('img[src="x"]')).toBeNull();
  });

  it('shows movement descriptions on click and hides them when the pointer leaves', () => {
    const { container } = render(<App />);
    expect(container.querySelector('img[src="/resources/icons/foot.svg"]')).toBeInTheDocument();
    expect(container.querySelector('img[src="/resources/icons/hand.svg"]')).toBeInTheDocument();
    const movement = screen.getByRole('button', { name: /Mouvement de pieds :Marche$/ });
    fireEvent.click(movement);
    expect(screen.getByRole('tooltip')).toHaveTextContent(/Avancer/);
    const item = container.querySelector('.movement-item');
    if (!item) throw new Error('Movement row was not rendered');
    fireEvent.pointerLeave(item);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('adds another editable choreography line', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter une ligne après 1.1' }));
    expect(screen.getByLabelText('Attaquant, ligne 1.2')).toBeInTheDocument();
    expect(screen.getByLabelText('Mouvement de main, ligne 1.2')).toBeInTheDocument();
    expect(screen.getByLabelText('Mouvement de pieds, ligne 1.2')).toBeInTheDocument();
  });

  it('offers movements only from the matching category', () => {
    render(<App />);
    const hand = screen.getByRole('combobox', { name: 'Mouvement de main, ligne 1.1' });
    fireEvent.change(hand, { target: { value: 'quarte' } });
    expect(screen.getByRole('listbox', { name: /Mouvement de main/ })).toHaveTextContent(/Quarte/);
    expect(within(screen.getByRole('listbox', { name: /Mouvement de main/ })).queryByRole('option', { name: 'Marche' })).not.toBeInTheDocument();
    fireEvent.change(hand, { target: { value: '' } });
    fireEvent.change(hand, { target: { value: 'attaq' } });
    expect(within(screen.getByRole('listbox', { name: /Mouvement de main/ })).getByRole('option', { name: 'Attaque' })).toBeInTheDocument();
    fireEvent.change(hand, { target: { value: '' } });

    const feet = screen.getByRole('combobox', { name: 'Mouvement de pieds, ligne 1.1' });
    fireEvent.change(feet, { target: { value: 'm' } });
    expect(screen.getByRole('listbox', { name: /Mouvement de pieds/ })).toHaveTextContent(/Marche/);
    expect(within(screen.getByRole('listbox', { name: /Mouvement de pieds/ })).queryByRole('option', { name: 'Quarte' })).not.toBeInTheDocument();
    expect(within(screen.getByRole('listbox', { name: /Mouvement de pieds/ })).queryByRole('option', { name: 'Supernova' })).not.toBeInTheDocument();
  });

  it('guides through all nine editor zones in order and finishes the tour', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Comment ça marche ?' }));
    const steps = ['fighters', 'assistants', 'movements', 'editor', 'project-info', 'phrases', 'lines', 'autosave', 'download'];

    steps.forEach((target, index) => {
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveTextContent(new RegExp(`Étape ${index + 1} sur 9`, 'i'));
      expect(document.querySelector(`[data-tour="${target}"]`)).toBeInTheDocument();
      fireEvent.click(within(dialog).getByRole('button', { name: index === steps.length - 1 ? 'Terminer' : 'Suivant' }));
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('can cancel the tour and highlights the first-line drop zone when the project has no lines', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Comment ça marche ?' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Annuler' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Supprimer la ligne 1.1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Comment ça marche ?' }));
    const dialog = screen.getByRole('dialog');
    for (let step = 0; step < 6; step += 1) fireEvent.click(within(dialog).getByRole('button', { name: 'Suivant' }));
    expect(document.querySelector('.empty-phrase[data-tour="lines"]')).toBeInTheDocument();
    expect(dialog).toHaveTextContent(/ajouter la première ligne/i);
  });

  it('completes characteristics in only the comma-delimited segment for both free-detail fields', () => {
    render(<App />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Mouvement de main, ligne 1.1' }), { target: { value: 'Attaque' } });
    const details = screen.getByRole('combobox', { name: 'Détail libre, ligne 1.1' });
    fireEvent.change(details, { target: { value: 'dir, ob, après', selectionStart: 3, selectionEnd: 3 } });
    fireEvent.click(screen.getByRole('option', { name: 'directe' }));
    expect(details).toHaveValue('directe, ob, après');

    fireEvent.change(details, { target: { value: 'directe, vert, après', selectionStart: 13, selectionEnd: 13 } });
    fireEvent.click(screen.getByRole('option', { name: 'verticale descendante' }));
    expect(details).toHaveValue('directe, verticale descendante, après');

    fireEvent.change(screen.getByRole('combobox', { name: 'Mouvement de main, ligne 1.1' }), { target: { value: 'Parade' } });
    fireEvent.focus(details);
    expect(screen.queryByRole('listbox', { name: /Détail libre/ })).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox', { name: 'Défenseur facultatif, ligne 1.1' }), { target: { value: 'Combattant B' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Mouvement de réaction du défenseur, ligne 1.1' }), { target: { value: 'Estoc' } });
    const reactionDetails = screen.getByRole('combobox', { name: 'Détail de réaction du défenseur, ligne 1.1' });
    fireEvent.change(reactionDetails, { target: { value: 'ligne, des', selectionStart: 10, selectionEnd: 10 } });
    fireEvent.click(screen.getByRole('option', { name: 'dessus' }));
    expect(reactionDetails).toHaveValue('ligne, dessus');
  });

  it('keeps each phrase as one parent group and starts the next at the previous end', () => {
    const { container } = render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter une ligne après 1.1' }));
    expect(container.querySelectorAll('.phrase-group')).toHaveLength(1);
    expect(container.querySelectorAll('.phrase-rail')).toHaveLength(1);

    const firstEnd = screen.getByRole('spinbutton', { name: 'Fin de Phrase d’armes 1' });
    fireEvent.change(firstEnd, { target: { value: '2.5' } });
    fireEvent.blur(firstEnd);
    fireEvent.click(screen.getByRole('button', { name: /Ajouter une Phrase d’armes/ }));

    expect(screen.getByRole('heading', { name: 'Phrase d’armes 2' })).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: 'Fin de Phrase d’armes 2' })).toHaveValue(2.5);
    expect(container.querySelectorAll('.phrase-rail')).toHaveLength(2);
  });

  it('renames all exact attacker and defender references when a fighter name is committed', () => {
    render(<App />);
    const attacker1 = screen.getByRole('combobox', { name: 'Attaquant, ligne 1.1' });
    const defender1 = screen.getByRole('combobox', { name: 'Défenseur facultatif, ligne 1.1' });
    fireEvent.change(attacker1, { target: { value: 'Combattant A' } });
    fireEvent.change(defender1, { target: { value: 'Combattant A' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter une ligne après 1.1' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Attaquant, ligne 1.2' }), { target: { value: 'Combattant A bis' } });

    const fighter = screen.getByRole('textbox', { name: 'Nom du combattant 1' });
    fireEvent.focus(fighter);
    fireEvent.change(fighter, { target: { value: 'Alice' } });
    expect(attacker1).toHaveValue('Combattant A');
    fireEvent.keyDown(fighter, { key: 'Enter' });

    expect(fighter).toHaveValue('Alice');
    expect(attacker1).toHaveValue('Alice');
    expect(defender1).toHaveValue('Alice');
    expect(screen.getByRole('combobox', { name: 'Attaquant, ligne 1.2' })).toHaveValue('Combattant A bis');
    const savedDraft = JSON.parse(window.localStorage.getItem('forgechoree.project.v5') ?? '{}');
    expect(savedDraft.fighters[0].name).toBe('Alice');
    expect(savedDraft.phrases[0].lines[0].attacker).toBe('Alice');
    expect(savedDraft.phrases[0].lines[0].defender).toBe('Alice');
  });

  it('restores an existing fighter name when cleared and leaves new empty fighters unlinked', () => {
    render(<App />);
    const attacker = screen.getByRole('combobox', { name: 'Attaquant, ligne 1.1' });
    fireEvent.change(attacker, { target: { value: 'Combattant A' } });

    const fighter = screen.getByRole('textbox', { name: 'Nom du combattant 1' });
    fireEvent.change(fighter, { target: { value: '' } });
    fireEvent.blur(fighter);
    expect(fighter).toHaveValue('Combattant A');
    expect(attacker).toHaveValue('Combattant A');

    fireEvent.click(screen.getByRole('button', { name: 'Ajouter un combattant' }));
    const newFighter = screen.getByRole('textbox', { name: 'Nom du combattant 3' });
    fireEvent.change(newFighter, { target: { value: 'Alice' } });
    fireEvent.blur(newFighter);
    expect(attacker).toHaveValue('Combattant A');
  });

  it('offers combined actions in the hand field and clears then hides the foot field', () => {
    render(<App />);
    const combinedMovement = screen.getByRole('button', { name: /Mouvement combiné :Supernova/ });
    expect(combinedMovement.querySelectorAll('img')).toHaveLength(2);

    const hand = screen.getByRole('combobox', { name: 'Mouvement de main, ligne 1.1' });
    const feet = screen.getByRole('combobox', { name: 'Mouvement de pieds, ligne 1.1' });
    fireEvent.change(feet, { target: { value: 'Marche' } });
    fireEvent.change(hand, { target: { value: 'Supernova' } });
    expect(screen.queryByRole('combobox', { name: 'Mouvement de pieds, ligne 1.1' })).not.toBeInTheDocument();

    fireEvent.change(hand, { target: { value: 'Parade' } });
    expect(screen.getByRole('combobox', { name: 'Mouvement de pieds, ligne 1.1' })).toHaveValue('');
  });

  it('stores project information and assistant identities in the local draft', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter un combattant' }));
    expect(screen.getByText('Bataille')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Mouvement d’ensemble' }));
    expect(screen.getByText('Ensemble')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Titre de la chorégraphie' }), { target: { value: 'Le duel' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Informations : intrigue, musiques' }), { target: { value: 'Une intrigue\nUne musique' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter un assistant' }));
    fireEvent.click(screen.getByText('Assistant 1'));
    fireEvent.change(screen.getByRole('textbox', { name: 'Prénom de l’assistant 1' }), { target: { value: 'Sam' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Rôle de l’assistant 1' }), { target: { value: 'Figurant' } });

    const savedDraft = JSON.parse(window.localStorage.getItem('forgechoree.project.v5') ?? '{}');
    expect(savedDraft.info).toMatchObject({ title: 'Le duel', notes: 'Une intrigue\nUne musique', ensemble: true });
    expect(savedDraft.assistants[0]).toMatchObject({ firstName: 'Sam', role: 'Figurant' });
  });

  it('calculates opposition duration on demand from the entered phrase timings', () => {
    render(<App />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Détail libre, ligne 1.1' }), { target: { value: 'Action' } });
    const firstEnd = screen.getByRole('spinbutton', { name: 'Fin de Phrase d’armes 1' });
    fireEvent.change(firstEnd, { target: { value: '10' } });
    fireEvent.blur(firstEnd);
    fireEvent.click(screen.getByRole('button', { name: /Ajouter une Phrase d’armes/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter la première ligne' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Détail libre, ligne 2.1' }), { target: { value: 'Suite' } });
    const secondEnd = screen.getByRole('spinbutton', { name: 'Fin de Phrase d’armes 2' });
    fireEvent.change(secondEnd, { target: { value: '15' } });
    fireEvent.blur(secondEnd);
    fireEvent.click(screen.getByRole('button', { name: 'Calculer la durée d’opposition' }));
    expect(screen.getByRole('textbox', { name: 'Durée d’opposition' })).toHaveValue('00m:15s');
  });

  it('shows the defender reaction with movement suggestions from every category', () => {
    render(<App />);
    const defender = screen.getByRole('combobox', { name: 'Défenseur facultatif, ligne 1.1' });
    expect(screen.queryByRole('combobox', { name: 'Mouvement de réaction du défenseur, ligne 1.1' })).not.toBeInTheDocument();
    fireEvent.change(defender, { target: { value: 'Combattant B' } });

    const reaction = screen.getByRole('combobox', { name: 'Mouvement de réaction du défenseur, ligne 1.1' });
    fireEvent.focus(reaction);
    fireEvent.change(reaction, { target: { value: 'quarte' } });
    expect(within(screen.getByRole('listbox', { name: /Mouvement de réaction du défenseur/ })).getByRole('option', { name: 'Quarte' })).toBeInTheDocument();
    fireEvent.change(reaction, { target: { value: 'marche' } });
    expect(within(screen.getByRole('listbox', { name: /Mouvement de réaction du défenseur/ })).getByRole('option', { name: 'Marche' })).toBeInTheDocument();
  });

  it('keeps reaction while replacing a defender and clears it on blur when defender remains empty', () => {
    render(<App />);
    const defender = screen.getByRole('combobox', { name: 'Défenseur facultatif, ligne 1.1' });
    fireEvent.change(defender, { target: { value: 'Combattant B' } });
    const reaction = screen.getByRole('combobox', { name: 'Mouvement de réaction du défenseur, ligne 1.1' });
    fireEvent.change(reaction, { target: { value: 'Esquive' } });

    fireEvent.change(defender, { target: { value: '' } });
    fireEvent.change(defender, { target: { value: 'Combattant A' } });
    expect(screen.getByRole('combobox', { name: 'Mouvement de réaction du défenseur, ligne 1.1' })).toHaveValue('Esquive');

    fireEvent.change(defender, { target: { value: '' } });
    fireEvent.blur(defender);
    expect(screen.queryByRole('combobox', { name: 'Mouvement de réaction du défenseur, ligne 1.1' })).not.toBeInTheDocument();
    fireEvent.change(defender, { target: { value: 'Combattant B' } });
    expect(screen.getByRole('combobox', { name: 'Mouvement de réaction du défenseur, ligne 1.1' })).toHaveValue('');
  });

  it('removes the saved draft without immediately writing a default draft back', () => {
    window.localStorage.setItem('forgechoree.project.v1', JSON.stringify({ fighters: ['Perso'], lines: [] }));
    window.confirm = () => true;
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Effacer le brouillon local' }));
    expect(window.localStorage.getItem('forgechoree.project.v1')).toBeNull();
    expect(window.localStorage.getItem('forgechoree.project.v2')).toBeNull();
    expect(window.localStorage.getItem('forgechoree.project.v3')).toBeNull();
    expect(window.localStorage.getItem('forgechoree.project.v4')).toBeNull();
    expect(window.localStorage.getItem('forgechoree.project.v5')).toBeNull();
    expect(screen.getByText(/brouillon local a été effacé/i)).toHaveAttribute('role', 'status');
  });
});
