'use client';

import { useEffect, useId, useState } from 'react';
import { getKnownPropertyKeysAction, getKnownPropertyValuesAction } from '@/app/analytics/actions';

const INPUT_CLASS = 'rounded border px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-900';

interface KnownEvent {
  event: string;
  n: number;
}

// The event-name field, shared by Event Search (one field feeding 3 filter
// rows below it) and the Funnel builder (one per step). `knownEvents` is
// fetched server-side once per page load — real events that have occurred,
// most frequent first, mirroring CleverTap's segment builder only offering
// events present in the account's own data. No client fetch needed for this
// list; it doesn't change while the page is open.
export function EventNameInput({
  name,
  defaultValue,
  knownEvents,
  onEventSettled,
  className,
  placeholder = 'e.g. screen_viewed',
}: {
  name: string;
  defaultValue?: string;
  knownEvents: KnownEvent[];
  onEventSettled?: (value: string) => void;
  className?: string;
  placeholder?: string;
}) {
  const listId = useId();
  return (
    <>
      <input
        type="text"
        name={name}
        defaultValue={defaultValue ?? ''}
        list={listId}
        placeholder={placeholder}
        className={className}
        onBlur={(e) => onEventSettled?.(e.target.value.trim())}
      />
      <datalist id={listId}>
        {knownEvents.map((ev) => (
          <option key={ev.event} value={ev.event}>{`${ev.event} (${ev.n})`}</option>
        ))}
      </datalist>
    </>
  );
}

// One key/value filter pair with cascading suggestions: property-key
// suggestions refetch whenever `event` changes, value suggestions refetch
// whenever `event` or the key the admin has settled on changes — matching
// CleverTap's event -> property -> value cascade. Any fetch failure just
// leaves the datalist empty; a filter field with no suggestions is still a
// perfectly usable plain text input, so nothing here needs to surface an error.
export function PropertyFilterRow({
  event,
  keyName,
  valueName,
  defaultKey,
  defaultValue,
}: {
  event: string;
  keyName: string;
  valueName: string;
  defaultKey?: string;
  defaultValue?: string;
}) {
  const keyListId = useId();
  const valueListId = useId();
  const [keys, setKeys] = useState<string[]>([]);
  const [values, setValues] = useState<{ value: string; n: number }[]>([]);
  const [settledKey, setSettledKey] = useState(defaultKey ?? '');

  useEffect(() => {
    let active = true;
    if (!event) {
      setKeys([]);
      return;
    }
    getKnownPropertyKeysAction(event).then((k) => {
      if (active) setKeys(k);
    });
    return () => {
      active = false;
    };
  }, [event]);

  useEffect(() => {
    let active = true;
    if (!event || !settledKey) {
      setValues([]);
      return;
    }
    getKnownPropertyValuesAction(event, settledKey).then((v) => {
      if (active) setValues(v);
    });
    return () => {
      active = false;
    };
  }, [event, settledKey]);

  return (
    <div className="flex gap-1">
      <input
        type="text"
        name={keyName}
        defaultValue={defaultKey ?? ''}
        placeholder="key"
        list={keyListId}
        className={INPUT_CLASS}
        onBlur={(e) => setSettledKey(e.target.value.trim())}
      />
      <datalist id={keyListId}>
        {keys.map((k) => (
          <option key={k} value={k} />
        ))}
      </datalist>
      <input
        type="text"
        name={valueName}
        defaultValue={defaultValue ?? ''}
        placeholder="value"
        list={valueListId}
        className={INPUT_CLASS}
      />
      <datalist id={valueListId}>
        {values.map((v) => (
          <option key={v.value} value={v.value}>{`${v.value} (${v.n})`}</option>
        ))}
      </datalist>
    </div>
  );
}
