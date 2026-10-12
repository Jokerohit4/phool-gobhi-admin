const STOP_WORDS_EN = ['stop', 'pain', 'hurt', 'doctor', 'trainer'];
const STOP_WORDS_HI = ['रुक', 'दर्द', 'डॉक्टर', 'ट्रेनर'];
const STOP_WORDS_HINGLISH = ['ruk', 'dard', 'doctor', 'trainer'];

const digitRegex = /\d/;

export function highlightLines(line: string): string {
  const lower = line.toLowerCase();
  const hasEnStop = STOP_WORDS_EN.some((w) => lower.includes(w));
  const hasHiStop = STOP_WORDS_HI.some((w) => line.includes(w));
  const hasHinglishStop = STOP_WORDS_HINGLISH.some((w) => lower.includes(w));
  const hasDigit = digitRegex.test(line);

  if (hasEnStop || hasHiStop || hasHinglishStop || hasDigit) {
    const marks: string[] = [];
    if (hasEnStop) marks.push('stop');
    if (hasHiStop) marks.push('दर्द');
    if (hasHinglishStop) marks.push('ruk');
    if (hasDigit) marks.push('digit');
    return `<span className="bg-red-100/30 text-red-400 px-1 rounded text-xs" title="${marks.join(', ')} highlighted">${line}</span>`;
  }
  return line;
}

export function lineCountDiffers(master: string, translation: string): boolean {
  const masterLines = master.split('\n').filter((l) => l.trim()).length;
  const transLines = translation.split('\n').filter((l) => l.trim()).length;
  return masterLines !== transLines;
}