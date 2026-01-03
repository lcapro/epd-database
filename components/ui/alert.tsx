import { cn } from '@/lib/classNames';

export type AlertVariant = 'info' | 'success' | 'warning' | 'danger';

const variantStyles: Record<AlertVariant, string> = {
  info: 'border-brand-100 bg-brand-50 text-brand-800',
  success: 'border-success-100 bg-success-50 text-success-800',
  warning: 'border-warning-100 bg-warning-50 text-warning-800',
  danger: 'border-danger-100 bg-danger-50 text-danger-800',
};

export function Alert({
  className,
  variant = 'info',
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { variant?: AlertVariant }) {
  return (
    <div
      role="alert"
      className={cn('rounded-xl border px-4 py-3 text-sm', variantStyles[variant], className)}
      {...props}
    />
  );
}

export function Toast({
  className,
  variant = 'info',
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { variant?: AlertVariant }) {
  return (
    <div
      role="status"
      className={cn('rounded-xl border px-4 py-3 text-sm shadow-md', variantStyles[variant], className)}
      {...props}
    />
  );
}
