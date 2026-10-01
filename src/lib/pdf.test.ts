import { afterEach, describe, expect, it, vi } from 'vitest';
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
});
