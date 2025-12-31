import { Suspense } from 'react';
import EpdDatabaseClient from './EpdDatabaseClient';

export default function EpdDatabasePage() {
  return (
    <Suspense fallback={<div className="card">Laden...</div>}>
      <EpdDatabaseClient />
    </Suspense>
  );
}
