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
    const movement = screen.getByRole('button', { name: /Marche/ });
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
    fireEvent.change(hand, { target: { value: 'a' } });
    expect(screen.getByRole('listbox', { name: /Mouvement de main/ })).toHaveTextContent(/Parade/);
    expect(within(screen.getByRole('listbox', { name: /Mouvement de main/ })).queryByRole('option', { name: 'Marche' })).not.toBeInTheDocument();
    fireEvent.change(hand, { target: { value: '' } });

    const feet = screen.getByRole('combobox', { name: 'Mouvement de pieds, ligne 1' });
    fireEvent.change(feet, { target: { value: 'm' } });
    expect(screen.getByRole('listbox', { name: /Mouvement de pieds/ })).toHaveTextContent(/Marche/);
    expect(within(screen.getByRole('listbox', { name: /Mouvement de pieds/ })).queryByRole('option', { name: 'Parade' })).not.toBeInTheDocument();
  });

  it('removes the saved draft without immediately writing a default draft back', () => {
    window.localStorage.setItem('forgechoree.project.v1', JSON.stringify({ fighters: ['Perso'], lines: [] }));
    window.confirm = () => true;
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Effacer le brouillon local' }));
    expect(window.localStorage.getItem('forgechoree.project.v1')).toBeNull();
    expect(window.localStorage.getItem('forgechoree.project.v2')).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent(/effacé/i);
  });
});
