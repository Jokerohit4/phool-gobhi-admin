// React 19 resets an uncontrolled form to its defaultValues after every form
// action finishes, success or not. On an optimistic-concurrency conflict that
// would throw away the admin's edit, so ActionForm snapshots the submitted
// FormData and, when the save reports a conflict, puts the values back with
// this function. Structural types only (no DOM lib dependency) so it can be unit
// tested without jsdom.

export interface RestorableField {
  name?: string;
  type?: string;
  value?: string;
  checked?: boolean;
  // <select multiple> exposes options; everything else leaves this undefined.
  options?: ArrayLike<{ value: string; selected: boolean }>;
}

// Fields that must NOT be restored: the concurrency token must keep the value
// the page rendered with (it is only refreshed by a reload).
const SKIP_NAMES = new Set(['expectedUpdatedAt']);

export function restoreFormValues(fields: ArrayLike<RestorableField>, submitted: FormData): void {
  for (let i = 0; i < fields.length; i++) {
    const field = fields[i];
    const name = field.name;
    if (!name || SKIP_NAMES.has(name)) continue;
    const type = field.type;
    if (type === 'hidden' || type === 'submit' || type === 'button' || type === 'file' || type === 'password') continue;

    const values = submitted.getAll(name).filter((v): v is string => typeof v === 'string');

    if (type === 'checkbox') {
      field.checked = values.includes(field.value ?? 'on');
    } else if (type === 'radio') {
      field.checked = values.includes(field.value ?? '');
    } else if (field.options) {
      for (let j = 0; j < field.options.length; j++) {
        field.options[j].selected = values.includes(field.options[j].value);
      }
    } else if (values.length) {
      field.value = values[0];
    } else {
      field.value = '';
    }
  }
}
