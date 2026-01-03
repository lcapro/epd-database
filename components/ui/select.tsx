import { forwardRef } from 'react';
import { cn } from '@/lib/classNames';

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  hasError?: boolean;
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, hasError = false, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'w-full rounded-xl border bg-white px-3 py-2 text-sm shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2',
        hasError ? 'border-danger-600' : 'border-gray-200 focus-visible:border-brand-600',
        className
      )}
      {...props}
    />
  )
);

Select.displayName = 'Select';
