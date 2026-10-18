import { afterEach, describe, expect, it, vi } from 'vitest';
import pdfMake from 'pdfmake/build/pdfmake.js';
import { defaultDraft } from './project';
import { downloadProjectPdf } from './pdf';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('PDF export', () => {
  it('generates and downloads an empty project with the selected page format', async () => {
    const createObjectURL = vi.fn(() => 'blob:project-pdf');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    await downloadProjectPdf(defaultDraft(), 'A4-landscape');

    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(click.mock.instances[0]).toHaveProperty('download', 'projet-choregraphique.pdf');
  });

  it('includes attacker and defender targets beside their movements', async () => {
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:project-pdf'), revokeObjectURL: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const createPdf = vi.spyOn(pdfMake, 'createPdf').mockReturnValue({ getBlob: async () => new Blob() } as never);
    const project = defaultDraft();
    const phrase = project.sections[0];
    if (phrase.type !== 'phrase') throw new Error('Default phrase missing');
    phrase.lines[0] = { ...phrase.lines[0], handMovement: 'Attaque', target: 'Zone 1', defender: 'Combattant B', defenderMovement: 'Riposte', defenderTarget: 'Zone 2' };

    await downloadProjectPdf(project, 'A4-landscape');

    expect(JSON.stringify(createPdf.mock.calls[0][0])).toContain('(cible : Zone 1)');
    expect(JSON.stringify(createPdf.mock.calls[0][0])).toContain('(cible : Zone 2)');
  });
});
