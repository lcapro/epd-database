import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'InfraImpact EPD Database',
  description: 'Upload, beheer en exporteer Environmental Product Declarations.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl">
      <body className="min-h-screen bg-transparent text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}
