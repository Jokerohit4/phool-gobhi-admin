'use client';

import { useState } from 'react';
import { ActionForm } from '@/components/ui/ActionForm';
import { ExpectedUpdatedAt } from '@/components/ui/ExpectedUpdatedAt';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { parsePositiveId } from '@/lib/ids';
import { saveGymPayoutAction } from './actions';
import type { GymPayout } from './config';

export function GymPayoutForm({ overrides }: { overrides: GymPayout[] }) {
  const [gymId, setGymId] = useState('');
  const parsedGymId = parsePositiveId(gymId);
  const existing = overrides.find((row) => row.gymId === parsedGymId);

  return <ActionForm action={saveGymPayoutAction} preserveOnError className="space-y-3">
    <ExpectedUpdatedAt value={existing?.updatedAt} />
    <div className="flex flex-wrap gap-3">
      <label className="grid gap-1 text-sm">Gym ID
        <input className="rounded border p-2 dark:bg-gray-900" name="gymId" inputMode="numeric" required
          value={gymId} onChange={(event) => setGymId(event.target.value)} />
      </label>
      <label className="grid gap-1 text-sm">Payout per visit (₹)
        <input className="rounded border p-2 dark:bg-gray-900" name="payoutRupees" type="number" required
          min="0.01" max="21474836.47" step="0.01" />
      </label>
    </div>
    <SubmitButton pendingText="Saving…">Add or update override</SubmitButton>
  </ActionForm>;
}
