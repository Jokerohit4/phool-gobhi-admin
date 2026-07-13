'use client';

import { useFormStatus } from 'react-dom';
import { Button } from './Button';
import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'danger' | 'secondary';

export function SubmitButton({
  children,
  pendingText,
  variant = 'primary',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { pendingText?: string; variant?: Variant }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending} className={className} {...props}>
      {pending ? pendingText || 'Working…' : children}
    </Button>
  );
}
