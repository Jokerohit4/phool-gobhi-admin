import { randomUUID } from 'node:crypto';
import Link from 'next/link';
import { ActionForm } from '@/components/ui/ActionForm';
import { Card } from '@/components/ui/Card';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { formatDateTimeIST } from '@/lib/dateFormat';
import { logSessionAction, resolveSessionAction, reverseCheckinPayoutAction } from './actions';
import type { DisputedSessions } from './sessions';

const input = 'w-full rounded border p-2 text-sm dark:bg-gray-900';
const field = 'grid gap-1 text-sm';

export function SessionLogForm() {
  return <Card className="space-y-3">
    <h2 className="text-lg font-semibold">Log a coaching session</h2>
    <ActionForm action={logSessionAction} preserveOnError confirmMessage="Log this completed session and use one session from the customer’s balance?" className="space-y-4">
      <input type="hidden" name="idempotencyKey" value={randomUUID()} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={field}>Customer ID
          <input className={input} name="userId" required inputMode="numeric" pattern="[1-9][0-9]*" />
        </label>
        <label className={field}>Kind
          <select className={input} name="kind"><option value="trainer">Trainer</option><option value="nutritionist">Nutritionist</option></select>
        </label>
        <label className={field}>Mode
          <select className={input} name="mode"><option value="online">Online</option><option value="in_person">In person</option></select>
        </label>
        <label className={field}>Held at (IST)
          <input className={input} type="datetime-local" name="heldAt" required />
        </label>
        <label className={field}>Duration in minutes (optional)
          <input className={input} type="number" name="durationMinutes" min="1" max="2147483647" />
        </label>
        <label className={field}>Note (optional)
          <textarea className={input} name="note" maxLength={500} rows={2} />
        </label>
      </div>
      <SubmitButton pendingText="Logging…">Log session</SubmitButton>
    </ActionForm>
  </Card>;
}

export function DisputedSessionQueue({ queue }: { queue: DisputedSessions }) {
  return <section id="disputed-sessions" className="space-y-3">
    <h2 className="text-lg font-semibold">Disputed sessions ({queue.total})</h2>
    {queue.sessions.length === 0 && <p className="text-sm text-gray-500">No disputed sessions on this page.</p>}
    {queue.sessions.map(session => <Card key={session.id} className="space-y-2 text-sm">
      <h3 className="font-semibold">Session #{session.id} · Customer #{session.userId}</h3>
      <p>{session.kind === 'trainer' ? 'Trainer' : 'Nutritionist'} · {session.mode === 'online' ? 'Online' : 'In person'} · {formatDateTimeIST(session.heldAt)} IST
        {session.durationMinutes !== null && ` · ${session.durationMinutes} min`}
      </p>
      {session.disputeReason && <p className="whitespace-pre-wrap break-words">{session.disputeReason}</p>}
      <div className="flex flex-wrap gap-3">
        <ActionForm action={resolveSessionAction} confirmMessage={`Uphold the existing charge of one session for session #${session.id}?`}>
          <input type="hidden" name="sessionId" value={session.id} />
          <input type="hidden" name="resolution" value="upheld" />
          <SubmitButton variant="secondary" pendingText="Resolving…">Uphold session</SubmitButton>
        </ActionForm>
        <ActionForm action={resolveSessionAction} confirmMessage={`Resolve dispute #${session.id} and return one session to the original membership?`}>
          <input type="hidden" name="sessionId" value={session.id} />
          <input type="hidden" name="resolution" value="recredited" />
          <SubmitButton variant="secondary" pendingText="Resolving…">Re-credit session</SubmitButton>
        </ActionForm>
      </div>
    </Card>)}
    <nav aria-label="Disputed session pages" className="flex gap-4 text-sm">
      {queue.page > 1 && <Link className="underline" href={`/fulfillment?disputesPage=${queue.page - 1}#disputed-sessions`}>Previous disputes</Link>}
      {queue.page * queue.limit < queue.total && <Link className="underline" href={`/fulfillment?disputesPage=${queue.page + 1}#disputed-sessions`}>Next disputes</Link>}
    </nav>
  </section>;
}

export function CheckinReversalForm() {
  return <Card className="space-y-3">
    <h2 className="text-lg font-semibold">Reverse check-in payout</h2>
    <ActionForm action={reverseCheckinPayoutAction} preserveOnError className="space-y-3"
      confirmMessage="Reverse the partner’s settled check-in payout for the booking ID entered above? This withdraws the credited amount.">
      <label className={field}>Booking ID
        <input className="w-full max-w-xs rounded border p-2 dark:bg-gray-900" name="bookingId" required inputMode="numeric" pattern="[1-9][0-9]*" />
      </label>
      <SubmitButton variant="danger" pendingText="Reversing…">Reverse check-in payout</SubmitButton>
    </ActionForm>
  </Card>;
}
