import { cn } from '@/lib/classNames';

export function FormField({
  label,
  htmlFor,
  required,
  helpText,
  error,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  required?: boolean;
  helpText?: string;
  error?: string | null;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('space-y-1', className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-danger-600"> *</span>}
      </label>
      {children}
      {helpText && !error && <p className="text-xs text-gray-500">{helpText}</p>}
      {error && (
        <p className="text-xs font-medium text-danger-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
