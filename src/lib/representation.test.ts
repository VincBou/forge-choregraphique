import { describe, expect, it } from 'vitest';
import { defaultDraft, type ChoreographyLine } from './project';
import { getRepresentationFocus, getRepresentationThreshold, parseDurationSeconds } from './representation';

const line = (id: string): ChoreographyLine => ({ id, attacker: 'A', handMovement: 'Attaque', footMovement: '', details: '', defender: '', defenderMovement: '', defenderDetails: '' });

describe('representation timeline', () => {
  it('parses the project duration and falls back to the chronology when it is unusable', () => {
    expect(parseDurationSeconds('02m:05.5s')).toBe(125.5);
    expect(parseDurationSeconds('00m:60s')).toBeNull();
    const project = defaultDraft();
    project.info.duration = '00m:00s';
    project.sections[0] = { ...project.sections[0], end: 18 };
    expect(getRepresentationThreshold(project)).toEqual({ seconds: 18, source: 'timeline' });
    project.info.duration = '03m:00s';
    expect(getRepresentationThreshold(project)).toEqual({ seconds: 180, source: 'duration' });
  });

  it('selects sections and divides a phrase linearly across started actions', () => {
    const project = defaultDraft();
    const phrase = project.sections[0];
    if (phrase.type !== 'phrase') throw new Error('Default phrase missing');
    project.sections = [
      { ...phrase, end: 10, lines: [line('one'), { ...line('blank'), attacker: '', handMovement: '' }, line('two')] },
      { type: 'temps', id: 'pause', end: 20 },
      { type: 'phrase', id: 'last', end: 30, lines: [line('last-line')] },
    ];
    expect(getRepresentationFocus(project, 0)).toMatchObject({ sectionId: phrase.id, sectionNumber: 1, lineId: 'one', lineNumber: 1 });
    expect(getRepresentationFocus(project, 4.999)?.lineId).toBe('one');
    expect(getRepresentationFocus(project, 5)).toMatchObject({ lineId: 'two', lineNumber: 3 });
    expect(getRepresentationFocus(project, 10)).toMatchObject({ sectionId: 'pause', sectionType: 'temps', sectionNumber: 1 });
    expect(getRepresentationFocus(project, 20)).toMatchObject({ sectionId: 'last', sectionNumber: 2, lineId: 'last-line' });
    expect(getRepresentationFocus(project, 30)).toBeNull();
  });

  it('keeps empty phrases active without inventing an action', () => {
    const project = defaultDraft();
    project.sections = [{ type: 'phrase', id: 'empty', end: 5, lines: [] }];
    expect(getRepresentationFocus(project, 2)).toEqual({ sectionId: 'empty', sectionType: 'phrase', sectionNumber: 1 });
  });
});
