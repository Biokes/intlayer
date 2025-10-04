import type { Locales } from '@intlayer/config/client';
import { getTranslation, type LanguageContent } from '@intlayer/core';
import { useContext } from 'solid-js';
import { IntlayerClientContext } from './IntlayerProvider';

/**
 * On the client side, this function returns the translation of the provided multilang content.
 *
 * If the locale is not provided, it will use the locale from the client context
 */
export const t = <Content = string>(
  multilangContent: LanguageContent<Content>,
  locale?: Locales
) => {
  const { locale: currentLocale } = useContext(IntlayerClientContext);
  const localeTarget =
    locale ??
    (typeof currentLocale === 'function' ? currentLocale() : currentLocale);

  return getTranslation<Content>(multilangContent, localeTarget);
};
