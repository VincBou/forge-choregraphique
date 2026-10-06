import { hasStartedLine, type ChoreographyLine, type ProjectDraft } from './project';

export type RepresentationThreshold = { seconds: number; source: 'duration' | 'timeline' } | null;
export type RepresentationFocus = { sectionId: string; sectionType: 'phrase' | 'temps'; sectionNumber: number; lineId?: string; lineNumber?: number };

export function parseDurationSeconds(value: string): number | null {
  const match = value.trim().match(/^(\d+)m:(\d{1,2}(?:[.,]\d+)?)s$/i);
  if (!match) return null;
  const minutes = Number(match[1]);
  const seconds = Number(match[2].replace(',', '.'));
  const total = minutes * 60 + seconds;
  return Number.isSafeInteger(minutes) && seconds < 60 && Number.isFinite(total) && total <= Number.MAX_SAFE_INTEGER ? total : null;
}

export function getRepresentationThreshold(project: ProjectDraft): RepresentationThreshold {
  const duration = parseDurationSeconds(project.info.duration);
  if (duration && duration > 0) return { seconds: duration, source: 'duration' };
  const timeline = project.sections.at(-1)?.end ?? 0;
  return timeline > 0 ? { seconds: timeline, source: 'timeline' } : null;
}

export function getRepresentationFocus(project: ProjectDraft, elapsedSeconds: number): RepresentationFocus | null {
  let start = 0;
  let phraseNumber = 0;
  let timeNumber = 0;
  for (const section of project.sections) {
    const number = section.type === 'phrase' ? ++phraseNumber : ++timeNumber;
    if (section.end > start && elapsedSeconds >= start && elapsedSeconds < section.end) {
      if (section.type === 'temps') return { sectionId: section.id, sectionType: 'temps', sectionNumber: number };
      const lines = section.lines.filter(hasStartedLine);
      if (!lines.length) return { sectionId: section.id, sectionType: 'phrase', sectionNumber: number };
      const lineIndex = Math.min(lines.length - 1, Math.floor(((elapsedSeconds - start) / (section.end - start)) * lines.length));
      const line: ChoreographyLine = lines[lineIndex];
      return { sectionId: section.id, sectionType: 'phrase', sectionNumber: number, lineId: line.id, lineNumber: section.lines.indexOf(line) + 1 };
    }
    start = section.end;
  }
  return null;
}
