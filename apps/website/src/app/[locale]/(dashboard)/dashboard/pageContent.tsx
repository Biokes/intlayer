'use client';

import { Loader } from '@intlayer/design-system';
import { type Session, useAuth } from '@intlayer/design-system/hooks';
import { useRouter } from 'next/navigation';
import { type FC, useEffect } from 'react';
import { PagesRoutes } from '@/Routes';

export const DashboardPageContent: FC<{ sessionServer?: Session }> = ({
  sessionServer,
}) => {
  const router = useRouter();
  const { session: sessionClient } = useAuth();

  const session = sessionServer ?? sessionClient;

  useEffect(() => {
    if (session?.organization && session?.project) {
      router.push(PagesRoutes.Dashboard_Content);
    } else if (session?.organization) {
      router.push(PagesRoutes.Dashboard_Projects);
    } else {
      router.push(PagesRoutes.Dashboard_Organization);
    }
  }, []);

  return <Loader />;
};
