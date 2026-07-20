type Tone = 'pending' | 'approved' | 'rejected' | 'active' | 'revoked' | 'unread' | 'read';

const TONE_CLASSES: Record<Tone, string> = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  approved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  revoked: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  unread: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  read: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

export function StatusBadge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${TONE_CLASSES[tone]}`}>
      {children}
    </span>
  );
}
