import { getDictionary, getLocalizedUrl, getMultilingualUrls } from 'intlayer';
import type { Metadata } from 'next';
import type { LocalPromiseParams } from 'next-intlayer';
import { PagesRoutes } from '@/Routes';
import metadataContent from './metadata.content';

export const generateMetadata = async ({
  params,
}: LocalPromiseParams): Promise<Metadata> => {
  const { locale } = await params;
  const { title, description, keywords } = getDictionary(
    metadataContent,
    locale
  );

  return {
    title,
    description,
    keywords,

    alternates: {
      canonical: getLocalizedUrl(PagesRoutes.Blog_Search, locale),
      languages: {
        ...getMultilingualUrls(PagesRoutes.Blog_Search),
        'x-default': PagesRoutes.Blog_Search,
      },
    },
    openGraph: {
      url: getLocalizedUrl(
        `${process.env.NEXT_PUBLIC_URL}${PagesRoutes.Blog_Search}`,
        locale
      ),
      title,
      description,
    },
  };
};
