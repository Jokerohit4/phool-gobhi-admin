'use client';

import { useState } from 'react';
import { EventNameInput, PropertyFilterRow } from './EventFilterBuilder';

interface KnownEvent {
  event: string;
  n: number;
}

// Owns the whole interactive body of the Event Search form — the event
// field is shared across all 3 filter rows below it (one target event per
// search, unlike the funnel builder where every step has its own), so it's
// lifted into state here rather than each row managing it independently.
// Days select and the Search button are static and could stay server-
// rendered, but live here too so the two rows keep their original layout
// without needing a second client/server boundary crossing mid-form.
export function EventSearchFields({
  knownEvents,
  defaultEvent,
  days,
  filterDefaults,
}: {
  knownEvents: KnownEvent[];
  defaultEvent?: string;
  days: string;
  filterDefaults: [string | undefined, string | undefined][];
}) {
  const [event, setEvent] = useState(defaultEvent ?? '');

  return (
    <>
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">Event name</label>
          <EventNameInput
            name="event"
            defaultValue={defaultEvent}
            knownEvents={knownEvents}
            onEventSettled={setEvent}
            className="w-56 rounded border px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">Days</label>
          <select name="days" defaultValue={days} className="rounded border px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900">
            {['7', '30', '90', '365'].map((d) => (
              <option key={d} value={d}>{d}d</option>
            ))}
          </select>
        </div>
        <button type="submit" className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white">
          Search
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs text-gray-500">Optional property filters (exact match):</span>
        {filterDefaults.map(([k, v], i) => (
          <PropertyFilterRow
            key={i}
            event={event}
            keyName={`f${i + 1}k`}
            valueName={`f${i + 1}v`}
            defaultKey={k}
            defaultValue={v}
          />
        ))}
      </div>
    </>
  );
}
