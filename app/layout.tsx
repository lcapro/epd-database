import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'InfraImpact EPD Database',
  description: 'Upload, beheer en exporteer Environmental Product Declarations.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl">
      <body className="min-h-screen bg-slate-50 text-slate-900">
        <header className="border-b bg-white shadow-sm">
          <div className="mx-auto max-w-5xl px-4 py-4">
            <h1 className="text-xl font-semibold">InfraImpact EPD Database</h1>
            <p className="text-sm text-slate-600">Upload, review en exporteer EPD&apos;s.</p>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
