// Visual switch over a real (visually hidden) checkbox, so it still submits
// via native form/FormData like any other checkbox — no action.ts changes
// needed when swapping a checkbox for this. Must not be wrapped in its own
// <label>: it's meant to sit inside the existing <label>+text that already
// toggles the input on click, and a nested <label> would be invalid HTML.
export function Toggle({
  name,
  defaultChecked,
}: {
  name: string;
  defaultChecked?: boolean;
}) {
  return (
    <span className="relative inline-flex h-6 w-11 shrink-0 items-center">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="peer sr-only" />
      <span
        className="pointer-events-none absolute inset-0 rounded-full bg-gray-300 transition-colors
          peer-checked:bg-emerald-600 dark:bg-gray-700"
      />
      <span
        className="pointer-events-none absolute left-0.5 h-5 w-5 rounded-full bg-white shadow
          transition-transform peer-checked:translate-x-5"
      />
    </span>
  );
}
