'use client';

import { useActionState, type ReactNode } from 'react';

export interface ActionState {
  ok?: boolean;
  message?: string;
}

export const initialActionState: ActionState = {};

interface ActionFormProps {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
  // If set, shows a native confirm() before submitting — used on high-stakes
  // actions (reject, payout, revoke, create-staff).
  confirmMessage?: string;
}

export function ActionForm({ action, children, className, confirmMessage }: ActionFormProps) {
  const [state, formAction] = useActionState(action, initialActionState);

  return (
    <form
      action={formAction}
      className={className}
      onSubmit={(e) => {
        if (confirmMessage && !window.confirm(confirmMessage)) {
          e.preventDefault();
        }
      }}
    >
      {children}
      {state.message && (
        <p className={`mt-1 text-sm ${state.ok ? 'text-emerald-600' : 'text-red-600'}`}>{state.message}</p>
      )}
    </form>
  );
}
