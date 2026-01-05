import SiteHeader from '@/components/layout/SiteHeader';
import SiteFooter from '@/components/layout/SiteFooter';
import PublicAuthRedirect from '@/components/auth/PublicAuthRedirect';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader showOrgSwitcher={false} />
      <PublicAuthRedirect />
      <main className="mx-auto w-full max-w-6xl px-6 py-10">{children}</main>
      <SiteFooter />
    </>
  );
}
