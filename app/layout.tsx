import './globals.css';
import type { Metadata } from 'next';
import SiteHeader from '@/components/layout/SiteHeader';
import SiteFooter from '@/components/layout/SiteFooter';

export const metadata: Metadata = {
  title: 'InfraImpact EPD Database',
  description: 'Upload, beheer en exporteer Environmental Product Declarations.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl">
      <body className="min-h-screen bg-transparent text-gray-900 antialiased">
        <SiteHeader />
        <main className="mx-auto w-full max-w-6xl px-6 py-10">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
