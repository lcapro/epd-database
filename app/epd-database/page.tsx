import { Suspense } from 'react';
import EpdDatabaseClient from './EpdDatabaseClient';
import { Card, Skeleton } from '@/components/ui';

export default function EpdDatabasePage() {
  return (
    <Suspense
      fallback={
        <Card>
          <div className="space-y-3">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-80" />
          </div>
        </Card>
      }
    >
      <EpdDatabaseClient />
    </Suspense>
  );
}
