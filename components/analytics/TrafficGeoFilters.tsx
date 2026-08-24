'use client';

import { useRef } from 'react';

// Country/city dropdowns for the Website Traffic view. Auto-submits its GET
// form on change (server-rendered navigation, no fetch of its own); the Apply
// button remains for keyboard/no-JS paths. Changing the country clears the
// city select first — the city options were scoped to the previous country,
// so submitting a stale pairing would just render an empty view.
export function TrafficGeoFilters({
  days,
  country,
  city,
  countries,
  cities,
}: {
  days: string;
  country: string;
  city: string;
  countries: string[];
  cities: string[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const cityRef = useRef<HTMLSelectElement>(null);

  return (
    <form ref={formRef} action="/analytics" method="get" className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="view" value="traffic" />
      <input type="hidden" name="days" value={days} />
      <div className="flex flex-col gap-1">
        <label htmlFor="traffic-country" className="text-xs text-gray-500">
          Country
        </label>
        <select
          id="traffic-country"
          name="country"
          defaultValue={country}
          onChange={() => {
            if (cityRef.current) cityRef.current.value = '';
            formRef.current?.requestSubmit();
          }}
          className="rounded border px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
        >
          <option value="">All countries</option>
          {countries.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="traffic-city" className="text-xs text-gray-500">
          City
        </label>
        <select
          id="traffic-city"
          ref={cityRef}
          name="city"
          defaultValue={city}
          onChange={() => formRef.current?.requestSubmit()}
          className="rounded border px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
        >
          <option value="">All cities</option>
          {cities.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white">
        Apply
      </button>
    </form>
  );
}
