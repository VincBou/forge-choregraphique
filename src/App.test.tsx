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

    const feet = screen.getByRole('combobox', { name: 'Mouvement de pieds, ligne 1.1' });
    fireEvent.change(feet, { target: { value: 'm' } });
    expect(screen.getByRole('listbox', { name: /Mouvement de pieds/ })).toHaveTextContent(/Marche/);
    expect(within(screen.getByRole('listbox', { name: /Mouvement de pieds/ })).queryByRole('option', { name: 'Quarte' })).not.toBeInTheDocument();
    expect(within(screen.getByRole('listbox', { name: /Mouvement de pieds/ })).queryByRole('option', { name: 'Supernova' })).not.toBeInTheDocument();
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
    const savedDraft = JSON.parse(window.localStorage.getItem('forgechoree.project.v4') ?? '{}');
    expect(savedDraft.fighters[0]).toBe('Alice');
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
    expect(screen.getByText(/brouillon local a été effacé/i)).toHaveAttribute('role', 'status');
  });
});
