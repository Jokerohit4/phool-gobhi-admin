'use client';

import { useActionState } from 'react';
import { Toggle } from '@/components/ui/Toggle';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { initialActionState, type ActionState } from '@/components/ui/ActionForm';

export const SOCIAL_ON_CONFIRM =
  'Switch social features on? Buddy, leaderboards and League become visible to every customer app install on its next launch.';

/// Confirm only when the save would turn social ON from off; switching it off
/// (the safe direction) never asks.
export function needsSocialConfirm(currentlyEnabled: boolean, nextEnabled: boolean): boolean {
  return !currentlyEnabled && nextEnabled;
}

export function SocialSwitch({
  enabled,
  action,
}: {
  enabled: boolean;
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const [state, formAction] = useActionState(action, initialActionState);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        const box = e.currentTarget.elements.namedItem('socialEnabled') as HTMLInputElement | null;
        if (needsSocialConfirm(enabled, Boolean(box?.checked)) && !window.confirm(SOCIAL_ON_CONFIRM)) {
          e.preventDefault();
        }
      }}
    >
      <label className="flex items-center gap-3 text-sm font-medium">
        <Toggle name="socialEnabled" defaultChecked={enabled} />
        Social features (buddy, leaderboards, league)
      </label>
      <p className="text-sm text-gray-500">Buddy also needs the buddy feature flag.</p>
      <SubmitButton pendingText="Saving…" className="w-fit">
        Save social switch
      </SubmitButton>
      {state.message && (
        <p className={`text-sm ${state.ok ? 'text-emerald-600' : 'text-red-600'}`}>{state.message}</p>
      )}
    </form>
  );
}
