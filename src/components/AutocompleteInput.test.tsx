import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AutocompleteInput from './AutocompleteInput';

describe('AutocompleteInput', () => {
  it('filters suggestions without restricting free-form input', () => {
    const onChange = vi.fn();
    render(<AutocompleteInput id="action" label="Action" value="par" suggestions={['Parade', 'Riposte']} onChange={onChange} />);
    fireEvent.focus(screen.getByRole('combobox', { name: 'Action' }));
    expect(screen.getByRole('option', { name: 'Parade' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Riposte' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: 'Action' }), { target: { value: 'parade libre' } });
    expect(onChange).toHaveBeenCalledWith('parade libre');
  });

  it('shows matching suggestions after removing accents', () => {
    render(<AutocompleteInput id="fighter" label="Combattant" value="ecl" suggestions={['Éclaireur', 'Gardien']} onChange={() => undefined} />);
    fireEvent.focus(screen.getByRole('combobox', { name: 'Combattant' }));
    expect(screen.getByRole('option', { name: 'Éclaireur' })).toBeInTheDocument();
  });

  it('supports choosing a suggestion with the keyboard', () => {
    const onChange = vi.fn();
    render(<AutocompleteInput id="action" label="Action" value="" suggestions={['Parade', 'Riposte']} onChange={onChange} />);
    const input = screen.getByRole('combobox', { name: 'Action' });
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('Parade');
  });
});
