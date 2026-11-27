const IST_OFFSET_MINUTES = 330;

// datetime-local inputs have no offset. Interpret them in IST on every host.
export function parseISTFormDate(value: string, label: string): string {
  const match = /^(\d{4}-\d{2}-\d{2})T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?$/.exec(value);
  if (match) {
    const day = new Date(match[1] + 'T00:00:00Z');
    const date = new Date(value + '+05:30');
    if (Number.isFinite(+date) && Number.isFinite(+day) && day.toISOString().startsWith(match[1])) {
      return date.toISOString();
    }
  }
  throw new Error(`Enter a valid ${label} in IST`);
}

export function toISTFormDate(value: string | null): string {
  if (!value) return '';
  const shifted = Date.parse(value) + IST_OFFSET_MINUTES * 60000;
  return Number.isFinite(shifted) ? new Date(shifted).toISOString().slice(0, -1) : '';
}
