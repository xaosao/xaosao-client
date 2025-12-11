import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Hook to initialize language from localStorage after hydration
 * This prevents hydration mismatches by only changing language on client-side
 */
export function useLanguageInit() {
  const { i18n } = useTranslation();

  useEffect(() => {
    // Only run on client-side after hydration
    if (typeof window !== 'undefined') {
      const storedLanguage = localStorage.getItem('i18nextLng');

      // If there's a stored language and it's different from current, change it
      if (storedLanguage && i18n.language !== storedLanguage) {
        i18n.changeLanguage(storedLanguage);
      }
    }
  }, [i18n]);
}
