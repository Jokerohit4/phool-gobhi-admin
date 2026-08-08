'use client';

import { useState } from 'react';
import { EventNameInput, PropertyFilterRow } from './EventFilterBuilder';

// One row of the funnel-create table. Unlike Event Search's shared event
// field, every step has its own — so the `event` state driving this row's
// filter-suggestion cascade is local here, not lifted to a parent.
export function FunnelStepRow({
  index,
  knownEvents,
}: {
  index: number;
  knownEvents: { event: string; n: number }[];
}) {
  const [event, setEvent] = useState('');

  return (
    <tr>
      <td className="py-1 pr-2 text-gray-400">{index}</td>
      <td className="py-1 pr-2">
        <EventNameInput
          name={`step${index}_event`}
          knownEvents={knownEvents}
          onEventSettled={setEvent}
          placeholder="event name"
          className="w-48 rounded border px-2 py-1 dark:border-gray-700 dark:bg-gray-900"
        />
      </td>
      <td className="py-1">
        <PropertyFilterRow event={event} keyName={`step${index}_filterKey`} valueName={`step${index}_filterValue`} />
      </td>
    </tr>
  );
}
