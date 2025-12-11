import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import lo from './locales/lo.json';
import th from './locales/th.json';

// Initialize i18n without LanguageDetector to avoid hydration issues
// Language will be detected and set on client-side by useLanguageInit hook
i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      lo: { translation: lo },
      th: { translation: th },
    },
    lng: 'en', // Always start with English for SSR consistency
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false, // Disable suspense to avoid hydration issues
    },
  });

export default i18n;