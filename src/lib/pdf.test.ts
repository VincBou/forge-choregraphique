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

  it('uses the FFE based category in the exported project summary', async () => {
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:project-pdf'), revokeObjectURL: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const createPdf = vi.spyOn(pdfMake, 'createPdf').mockReturnValue({ getBlob: async () => new Blob() } as never);
    const project = defaultDraft();
    project.fighters[0].firstName = 'Alice';
    project.fighters[1].licenseNumber = '12345';

    await downloadProjectPdf(project, 'A4-landscape');

    expect(JSON.stringify(createPdf.mock.calls[0][0])).toContain('Duel');
  });

  it('includes attacker and defender targets beside their movements', async () => {
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:project-pdf'), revokeObjectURL: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const createPdf = vi.spyOn(pdfMake, 'createPdf').mockReturnValue({ getBlob: async () => new Blob() } as never);
    const project = defaultDraft();
    const phrase = project.sections[0];
    if (phrase.type !== 'phrase') throw new Error('Default phrase missing');
    phrase.lines[0] = { ...phrase.lines[0], handMovement: 'Attaque', target: 'Zone 1', defender: 'Combattant B', defenderHandMovement: 'Riposte', defenderFootMovement: 'Marche', defenderTarget: 'Zone 2' };

    await downloadProjectPdf(project, 'A4-landscape');

    expect(JSON.stringify(createPdf.mock.calls[0][0])).toContain('(cible : Zone 1)');
    expect(JSON.stringify(createPdf.mock.calls[0][0])).toContain('(cible : Zone 2)');
    expect(JSON.stringify(createPdf.mock.calls[0][0])).toContain('Riposte Marche');
  });

  it('includes choreographic time descriptions and keeps the fallback when empty', async () => {
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:project-pdf'), revokeObjectURL: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const createPdf = vi.spyOn(pdfMake, 'createPdf').mockReturnValue({ getBlob: async () => new Blob() } as never);
    const project = defaultDraft();
    project.sections.push(
      { type: 'temps', id: 'time', end: 4, description: 'Une entrée en scène\npuis un salut.' },
      { type: 'temps', id: 'empty-time', end: 5, description: '' },
    );

    await downloadProjectPdf(project, 'A4-landscape');

    const pdfContent = JSON.stringify(createPdf.mock.calls[0][0]);
    expect(pdfContent).toContain('Une entrée en scène\\npuis un salut.');
    expect(pdfContent).toContain('Temps chorégraphique sans action de combat.');
  });
});
