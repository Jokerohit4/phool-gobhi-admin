'use client';

import { useActionState, useEffect, useRef, type ReactNode } from 'react';
import { restoreFormValues } from '@/lib/formRestore';

export interface ActionState {
  ok?: boolean;
  message?: string;
  // Set when the save lost an optimistic-concurrency race (CONFIG_CONFLICT).
  // The form keeps what the admin typed so they can re-apply it after reloading.
  conflict?: boolean;
}

export const initialActionState: ActionState = {};

interface ActionFormProps {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
  // If set, shows a native confirm() before submitting — used on high-stakes
  // actions (reject, payout, revoke, create-staff).
  confirmMessage?: string;
  preserveOnError?: boolean;
}

export function ActionForm({ action, children, className, confirmMessage, preserveOnError }: ActionFormProps) {
  const [state, formAction] = useActionState(action, initialActionState);
  const formRef = useRef<HTMLFormElement>(null);
  // Snapshot of what was submitted. React resets the form once the action
  // settles. Restore values after conflicts and when a form opts in for other
  // errors so the admin can correct their submission.
  const submittedRef = useRef<FormData | null>(null);

  useEffect(() => {
    if ((state.conflict || (preserveOnError && state.ok === false)) && formRef.current && submittedRef.current) {
      restoreFormValues(Array.from(formRef.current.elements) as unknown as Parameters<typeof restoreFormValues>[0], submittedRef.current);
    }
  }, [state, preserveOnError]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className={className}
      onSubmit={(e) => {
        if (confirmMessage && !window.confirm(confirmMessage)) {
          e.preventDefault();
          return;
        }
        submittedRef.current = new FormData(e.currentTarget);
      }}
    >
      {children}
      {state.message && (
        <p role={state.ok ? 'status' : 'alert'} className={`mt-1 text-sm ${state.ok ? 'text-emerald-600' : 'text-red-600'}`}>{state.message}</p>
      )}
    </form>
  );
}
