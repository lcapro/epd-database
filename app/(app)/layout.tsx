import SiteHeader from '@/components/layout/SiteHeader';
import SiteFooter from '@/components/layout/SiteFooter';
import AuthGate from '@/components/auth/AuthGate';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AuthGate />
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl px-6 py-10">{children}</main>
      <SiteFooter />
    </>
  );
}
