import { AuthenticationBarrier } from '@components/Auth/AuthenticationBarrier/AuthenticationBarrier';
import { getServerSession } from '@components/Auth/getServerSession';
import { DashboardFooter } from '@components/Dashboard/DashboardFooter';
import { DashboardNavbar } from '@components/Dashboard/DashboardNavbar/DashboardNavbar';
import type { Session } from '@intlayer/backend';
import { PageLayout } from '@layouts/PageLayout';
import type { LocalesValues } from 'intlayer';
import type { NextLayoutIntlayer } from 'next-intlayer';
import { useIntlayer } from 'next-intlayer/server';
import type { FC, PropsWithChildren } from 'react';
import { PagesRoutes } from '@/Routes';

export { generateMetadata } from './metadata';

// Required to revalidate session after user login/logout

const DashboardLayoutContent: FC<
  PropsWithChildren<{ locale: LocalesValues; session: Session | null }>
> = ({ children, locale, session }) => {
  const { navbarLinks, footerLinks } = useIntlayer('dashboard-navbar-content');

  const formattedNavbarLinks = navbarLinks.map((el) => ({
    ...el,
    url: el.url.value,
    label: el.label.value,
  }));

  const formattedFooterLinks = footerLinks.map((el) => ({
    ...el,
    href: el.href.value,
    label: el.label.value,
  }));

  return (
    <PageLayout
      locale={locale}
      navbar={<DashboardNavbar links={formattedNavbarLinks} />}
      footer={<DashboardFooter locale={locale} links={formattedFooterLinks} />}
    >
      <AuthenticationBarrier
        accessRule="authenticated"
        redirectionRoute={`${PagesRoutes.Auth_SignIn}?redirect_url=${encodeURIComponent(PagesRoutes.Dashboard)}`}
        session={session}
        locale={locale}
      >
        {children}
      </AuthenticationBarrier>
    </PageLayout>
  );
};

const DashboardLayout: NextLayoutIntlayer = async ({ children, params }) => {
  const { locale } = await params;
  const session = await getServerSession();

  return (
    <DashboardLayoutContent locale={locale} session={session}>
      {children}
    </DashboardLayoutContent>
  );
};

export default DashboardLayout;
