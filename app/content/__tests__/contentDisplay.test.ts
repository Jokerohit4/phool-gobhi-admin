import { describe, it, expect } from 'vitest';
import {
  bodyParagraphs,
  buildQueueQuery,
  editPayload,
  filterHref,
  isSafetyLine,
  lineCountDiffers,
  parseFilters,
  textToLines,
} from '../contentDisplay';

describe('isSafetyLine', () => {
  it.each([
    'Stop if your knee hurts',
    'If you feel sharp pain, rest',
    'Ask a doctor before starting',
    'Check form with your trainer',
    'Stopping halfway is fine',
  ])('flags English safety words: %s', (line) => {
    expect(isSafetyLine(line)).toBe(true);
  });

  it.each([
    'घुटने में दर्द हो तो रुकें',
    'डॉक्टर से पूछें',
    'अपने ट्रेनर से फॉर्म चेक कराएं',
    'वहीं रुक जाइए',
  ])('flags Hindi safety words: %s', (line) => {
    expect(isSafetyLine(line)).toBe(true);
  });

  it.each(['Dard ho toh ruk jao', 'Agar knee mein dard hai', 'Thoda rukiye', 'Doctor se poochho'])(
    'flags Hinglish safety words: %s',
    (line) => {
      expect(isSafetyLine(line)).toBe(true);
    },
  );

  it.each(['Do 10 reps', 'Hold for 30 seconds', '१२ बार करें'])('flags any digit: %s', (line) => {
    expect(isSafetyLine(line)).toBe(true);
  });

  it.each(['Keep your back straight', 'Breathe out as you push', 'Use a standard grip', 'कमर सीधी रखें'])(
    'leaves a plain line alone: %s',
    (line) => {
      expect(isSafetyLine(line)).toBe(false);
    },
  );

  it('treats empty input as plain', () => {
    expect(isSafetyLine('')).toBe(false);
    expect(isSafetyLine(null)).toBe(false);
    expect(isSafetyLine(undefined)).toBe(false);
  });
});

describe('lineCountDiffers', () => {
  it('is false when the counts match', () => {
    expect(lineCountDiffers(['a', 'b'], ['x', 'y'])).toBe(false);
  });

  it('is true when the translation dropped or added a line', () => {
    expect(lineCountDiffers(['a'], ['x', 'y'])).toBe(true);
    expect(lineCountDiffers(['a', 'b', 'c'], ['x', 'y'])).toBe(true);
  });

  it('treats a missing translation list as zero lines', () => {
    expect(lineCountDiffers(undefined, ['x'])).toBe(true);
  });

  it('is false when there is no English master to compare with', () => {
    expect(lineCountDiffers(['a'], null)).toBe(false);
    expect(lineCountDiffers(['a'], undefined)).toBe(false);
  });
});

describe('searchParams → queue query', () => {
  it('defaults status to pending and leaves type/lang unset', () => {
    const filters = parseFilters({});
    expect(filters).toEqual({ type: null, lang: null, status: 'pending' });
    expect(buildQueueQuery(filters)).toBe('status=pending');
  });

  it('passes valid filters through', () => {
    const filters = parseFilters({ type: 'exercise', lang: 'hinglish', status: 'approved' });
    expect(buildQueueQuery(filters)).toBe('type=exercise&lang=hinglish&status=approved');
  });

  it('drops unknown values instead of sending them to the backend', () => {
    const filters = parseFilters({ type: 'video', lang: 'fr', status: 'deleted' });
    expect(filters).toEqual({ type: null, lang: null, status: 'pending' });
  });

  it('uses the first value of a repeated param', () => {
    expect(parseFilters({ lang: ['hi', 'en'] }).lang).toBe('hi');
  });

  it('builds filter links that keep the other filters', () => {
    const filters = parseFilters({ type: 'article', lang: 'hi' });
    expect(filterHref(filters, { status: 'rejected' })).toBe('/content?type=article&lang=hi&status=rejected');
    expect(filterHref(filters, { lang: null })).toBe('/content?type=article');
    expect(filterHref(parseFilters({}), {})).toBe('/content');
  });
});

describe('editPayload', () => {
  it('keeps only steps, feelCues and mistakes for an exercise', () => {
    const payload = editPayload('exercise', {
      steps: ['  Stand tall ', '', 'Push'],
      feelCues: 'Chest\n\n  Triceps  ',
      mistakes: ['Flaring elbows'],
      reviewStatus: 'approved',
      version: 9,
      lang: 'en',
      title: 'nope',
    });
    expect(payload).toEqual({
      steps: ['Stand tall', 'Push'],
      feelCues: ['Chest', 'Triceps'],
      mistakes: ['Flaring elbows'],
    });
  });

  it('keeps only title and body for an article', () => {
    const payload = editPayload('article', {
      title: ' First visit ',
      body: 'Hello',
      reviewStatus: 'approved',
      reviewedBy: 1,
      steps: ['x'],
    });
    expect(payload).toEqual({ title: 'First visit', body: 'Hello' });
  });
});

describe('text helpers', () => {
  it('splits a textarea into one item per non-blank line', () => {
    expect(textToLines('a\r\n\n  b  \n')).toEqual(['a', 'b']);
  });

  it('splits an article body into paragraphs on blank lines', () => {
    expect(bodyParagraphs('One\nstill one\n\nTwo\n \nThree')).toEqual(['One\nstill one', 'Two', 'Three']);
    expect(bodyParagraphs(null)).toEqual([]);
  });
});
