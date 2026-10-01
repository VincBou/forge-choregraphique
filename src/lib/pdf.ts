import pdfMake from 'pdfmake/build/pdfmake.js';
import pdfFonts from 'pdfmake/build/vfs_fonts.js';
import type { ProjectDraft, ChoreographyLine } from './project';
import { hasStartedLine } from './project';

type PdfPageFormat = 'A4-portrait' | 'A4-landscape' | 'A3-portrait' | 'A3-landscape';
type PdfCell = { text: string; fillColor?: string; bold?: boolean; color?: string };

pdfMake.addVirtualFileSystem(pdfFonts);

const colors = ['#dce8ff', '#ffe8c4', '#dcf5e8', '#f1ddff', '#ffe0e3', '#d8f2f5'];
const safeText = (value: string) => value.trim() || '—';
const formatTime = (value: number) => Number.isInteger(value) ? value.toFixed(1) : String(value);

function cell(text: string, fillColor?: string, bold = false): PdfCell {
  return { text: safeText(text), fillColor: fillColor ?? '#f2f3f5', bold };
}

function lineRow(line: ChoreographyLine, fighters: ProjectDraft['fighters']): PdfCell[] {
  const attackerColor = colors[fighters.findIndex((fighter) => fighter.name === line.attacker.trim()) % colors.length];
  const defenderColor = colors[fighters.findIndex((fighter) => fighter.name === line.defender.trim()) % colors.length];
  const offensive = [line.handMovement, line.footMovement].filter((value) => value.trim()).join(' / ');
  return [
    cell(line.attacker, attackerColor),
    cell(offensive),
    cell(line.details),
    cell(line.defender, line.defender.trim() ? defenderColor : undefined),
    cell(line.defenderMovement),
    cell(line.defenderDetails),
  ];
}

export async function downloadProjectPdf(draft: ProjectDraft, selectedFormat: string): Promise<void> {
  const format: PdfPageFormat = (['A4-portrait', 'A4-landscape', 'A3-portrait', 'A3-landscape'] as string[]).includes(selectedFormat)
    ? selectedFormat as PdfPageFormat : 'A4-landscape';
  const [pageSize, pageOrientation] = format.split('-') as ['A4' | 'A3', 'portrait' | 'landscape'];
  const actionCount = draft.phrases.reduce((count, phrase) => count + phrase.lines.filter(hasStartedLine).length, 0);
  const category = draft.fighters.length === 0 ? 'Non définie' : draft.fighters.length === 1 ? 'Kata' : draft.fighters.length === 2 ? 'Duel' : draft.info.ensemble ? 'Ensemble' : 'Bataille';
  const content: unknown[] = [
    { text: draft.info.title.trim() || 'Projet chorégraphique', style: 'title' },
    { text: 'Sabre Laser · Dossier chorégraphique ASL-FFE', style: 'subtitle' },
    { text: 'Informations générales', style: 'sectionTitle' },
    {
      table: {
        widths: ['*', '*', '*', '*', '*', '*'],
        body: [
          ['Club', 'Catégorie', 'Durée', 'Durée d’opposition', 'Phrases', 'Actions'],
          [safeText(draft.info.club), category, safeText(draft.info.duration), safeText(draft.info.oppositionDuration), String(draft.phrases.length), String(actionCount)],
        ],
      }, layout: 'lightHorizontalLines',
    },
    { text: 'Informations : intrigue, musiques…', style: 'smallHeading', margin: [0, 14, 0, 4] },
    { text: safeText(draft.info.notes), style: 'body' },
    { text: `Mouvement d’ensemble : ${draft.info.ensemble ? 'Oui' : 'Non'}`, style: 'body', margin: [0, 4, 0, 0] },
    { text: 'Combattants', style: 'sectionTitle' },
    {
      table: {
        headerRows: 1,
        widths: ['*', '*', '*', '*', 58],
        body: [
          ['Prénom', 'Nom', 'Licence', 'Nom dans le projet', 'Capitaine'],
          ...draft.fighters.map((fighter) => [safeText(fighter.firstName), safeText(fighter.lastName), safeText(fighter.licenseNumber), safeText(fighter.name), fighter.captain ? 'Oui' : 'Non']),
        ],
      }, layout: 'lightHorizontalLines',
    },
    { text: 'Assistants et figurants', style: 'sectionTitle' },
    draft.assistants.length ? {
      table: {
        headerRows: 1,
        widths: ['*', '*', '*', '*'],
        body: [['Prénom', 'Nom', 'Licence', 'Rôle'], ...draft.assistants.map((assistant) => [safeText(assistant.firstName), safeText(assistant.lastName), safeText(assistant.licenseNumber), safeText(assistant.role)])],
      }, layout: 'lightHorizontalLines',
    } : { text: 'Aucun assistant ou figurant renseigné.', style: 'body' },
  ];

  let start = 0;
  for (const [index, phrase] of draft.phrases.entries()) {
    content.push(
      { text: `Phrase d’armes ${index + 1}`, style: 'sectionTitle', pageBreak: 'before' },
      { columns: [{ text: `${formatTime(start)} · Début`, style: 'body' }, { text: `${formatTime(phrase.end)} · Fin`, alignment: 'right', style: 'body' }], margin: [0, 0, 0, 10] },
    );
    const lines = phrase.lines.filter(hasStartedLine);
    if (lines.length) {
      content.push({
        table: {
          headerRows: 1,
          widths: ['*', '*', '*', '*', '*', '*'],
          body: [
            ['Attaquant', 'Mouvements', 'Détails / intention', 'Défenseur', 'Réaction', 'Détails de réaction'],
            ...lines.map((line) => lineRow(line, draft.fighters)),
          ],
        }, layout: 'lightHorizontalLines',
      });
    } else {
      content.push({ text: 'Aucune action renseignée.', style: 'body', italics: true });
    }
    start = phrase.end;
  }

  const pdf = pdfMake.createPdf({
    info: { title: draft.info.title.trim() || 'Projet chorégraphique ASL-FFE', subject: 'Chorégraphie de sabre laser' },
    pageSize,
    pageOrientation,
    pageMargins: [34, 38, 34, 34],
    content,
    defaultStyle: { font: 'Roboto', fontSize: 9, color: '#242832' },
    styles: {
      title: { fontSize: 22, bold: true, color: '#26334a', margin: [0, 0, 0, 4] },
      subtitle: { fontSize: 10, color: '#697386', margin: [0, 0, 0, 17] },
      sectionTitle: { fontSize: 13, bold: true, color: '#26334a', margin: [0, 16, 0, 7] },
      smallHeading: { fontSize: 10, bold: true, color: '#465064' },
      body: { fontSize: 9, lineHeight: 1.2 },
    },
    footer: (currentPage: number, pageCount: number) => ({
      columns: [
        { text: 'Forge Chorégraphique · ASL-FFE', alignment: 'left' },
        { text: `${currentPage} / ${pageCount}`, alignment: 'right' },
      ], margin: [34, 10, 34, 0], fontSize: 8, color: '#697386',
    }),
  });
  const blob = await pdf.getBlob();
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = 'projet-choregraphique.pdf';
    link.click();
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}
