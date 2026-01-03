import { cn } from '@/lib/classNames';
import { Button } from './button';

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  className,
}: {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-10 text-center',
        className
      )}
    >
      <h4 className="text-base font-semibold text-gray-900">{title}</h4>
      {description && <p className="mt-2 text-sm text-gray-600">{description}</p>}
      {(actionLabel || secondaryActionLabel) && (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {actionLabel && onAction && (
            <Button variant="secondary" size="sm" onClick={onAction}>
              {actionLabel}
            </Button>
          )}
          {secondaryActionLabel && onSecondaryAction && (
            <Button variant="secondary" size="sm" onClick={onSecondaryAction}>
              {secondaryActionLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
