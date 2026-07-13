import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'danger' | 'secondary';

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: 'bg-emerald-600 text-white hover:bg-emerald-700',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  secondary: 'border bg-transparent hover:bg-gray-50 dark:hover:bg-gray-800',
};

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={`rounded px-3 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    />
  );
}
