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
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter une ligne après la ligne 1' }));
    expect(screen.getByLabelText('Attaquant, ligne 2')).toBeInTheDocument();
    expect(screen.getByLabelText('Mouvement de main, ligne 2')).toBeInTheDocument();
    expect(screen.getByLabelText('Mouvement de pieds, ligne 2')).toBeInTheDocument();
  });

  it('offers movements only from the matching category', () => {
    render(<App />);
    const hand = screen.getByRole('combobox', { name: 'Mouvement de main, ligne 1' });
    fireEvent.change(hand, { target: { value: 'quarte' } });
    expect(screen.getByRole('listbox', { name: /Mouvement de main/ })).toHaveTextContent(/Quarte/);
    expect(within(screen.getByRole('listbox', { name: /Mouvement de main/ })).queryByRole('option', { name: 'Marche' })).not.toBeInTheDocument();
    fireEvent.change(hand, { target: { value: '' } });

    const feet = screen.getByRole('combobox', { name: 'Mouvement de pieds, ligne 1' });
    fireEvent.change(feet, { target: { value: 'm' } });
    expect(screen.getByRole('listbox', { name: /Mouvement de pieds/ })).toHaveTextContent(/Marche/);
    expect(within(screen.getByRole('listbox', { name: /Mouvement de pieds/ })).queryByRole('option', { name: 'Quarte' })).not.toBeInTheDocument();
    expect(within(screen.getByRole('listbox', { name: /Mouvement de pieds/ })).queryByRole('option', { name: 'Supernova' })).not.toBeInTheDocument();
  });

  it('offers combined actions in the hand field and clears then hides the foot field', () => {
    render(<App />);
    const combinedMovement = screen.getByRole('button', { name: /Mouvement combiné :Supernova/ });
    expect(combinedMovement.querySelectorAll('img')).toHaveLength(2);

    const hand = screen.getByRole('combobox', { name: 'Mouvement de main, ligne 1' });
    const feet = screen.getByRole('combobox', { name: 'Mouvement de pieds, ligne 1' });
    fireEvent.change(feet, { target: { value: 'Marche' } });
    fireEvent.change(hand, { target: { value: 'Supernova' } });
    expect(screen.queryByRole('combobox', { name: 'Mouvement de pieds, ligne 1' })).not.toBeInTheDocument();

    fireEvent.change(hand, { target: { value: 'Parade' } });
    expect(screen.getByRole('combobox', { name: 'Mouvement de pieds, ligne 1' })).toHaveValue('');
  });

  it('shows the defender reaction with movement suggestions from every category', () => {
    render(<App />);
    const defender = screen.getByRole('combobox', { name: 'Défenseur facultatif, ligne 1' });
    expect(screen.queryByRole('combobox', { name: 'Mouvement de réaction du défenseur, ligne 1' })).not.toBeInTheDocument();
    fireEvent.change(defender, { target: { value: 'Combattant B' } });

    const reaction = screen.getByRole('combobox', { name: 'Mouvement de réaction du défenseur, ligne 1' });
    fireEvent.focus(reaction);
    fireEvent.change(reaction, { target: { value: 'quarte' } });
    expect(within(screen.getByRole('listbox', { name: /Mouvement de réaction du défenseur/ })).getByRole('option', { name: 'Quarte' })).toBeInTheDocument();
    fireEvent.change(reaction, { target: { value: 'marche' } });
    expect(within(screen.getByRole('listbox', { name: /Mouvement de réaction du défenseur/ })).getByRole('option', { name: 'Marche' })).toBeInTheDocument();
  });

  it('keeps reaction while replacing a defender and clears it on blur when defender remains empty', () => {
    render(<App />);
    const defender = screen.getByRole('combobox', { name: 'Défenseur facultatif, ligne 1' });
    fireEvent.change(defender, { target: { value: 'Combattant B' } });
    const reaction = screen.getByRole('combobox', { name: 'Mouvement de réaction du défenseur, ligne 1' });
    fireEvent.change(reaction, { target: { value: 'Esquive' } });

    fireEvent.change(defender, { target: { value: '' } });
    fireEvent.change(defender, { target: { value: 'Combattant A' } });
    expect(screen.getByRole('combobox', { name: 'Mouvement de réaction du défenseur, ligne 1' })).toHaveValue('Esquive');

    fireEvent.change(defender, { target: { value: '' } });
    fireEvent.blur(defender);
    expect(screen.queryByRole('combobox', { name: 'Mouvement de réaction du défenseur, ligne 1' })).not.toBeInTheDocument();
    fireEvent.change(defender, { target: { value: 'Combattant B' } });
    expect(screen.getByRole('combobox', { name: 'Mouvement de réaction du défenseur, ligne 1' })).toHaveValue('');
  });

  it('removes the saved draft without immediately writing a default draft back', () => {
    window.localStorage.setItem('forgechoree.project.v1', JSON.stringify({ fighters: ['Perso'], lines: [] }));
    window.confirm = () => true;
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Effacer le brouillon local' }));
    expect(window.localStorage.getItem('forgechoree.project.v1')).toBeNull();
    expect(window.localStorage.getItem('forgechoree.project.v2')).toBeNull();
    expect(window.localStorage.getItem('forgechoree.project.v3')).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent(/effacé/i);
  });
});
