// Shown automatically by Next.js while the analytics Server Component fetches
// — without this, switching tabs was a full blank flash until data resolved.
export default function Loading() {
  return (
    <div className="flex animate-pulse flex-col gap-4">
      <div className="h-6 w-40 rounded bg-gray-200 dark:bg-gray-800" />
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-7 w-24 rounded bg-gray-200 dark:bg-gray-800" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-20 rounded-lg bg-gray-200 dark:bg-gray-800" />
        ))}
      </div>
      <div className="h-64 rounded-lg bg-gray-200 dark:bg-gray-800" />
    </div>
  );
}
