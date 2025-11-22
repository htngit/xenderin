import { createContext, useContext, useState, ReactNode } from 'react';
import { IntlProvider as ReactIntlProvider } from 'react-intl';
import enMessages from '../../locales/en.json';
import idMessages from '../../locales/id.json';

type Locale = 'en' | 'id';

interface LocaleContextType {
    locale: Locale;
    setLocale: (locale: Locale) => void;
}

const LocaleContext = createContext<LocaleContextType | undefined>(undefined);

const messages: Record<Locale, Record<string, string>> = {
    en: enMessages,
    id: idMessages,
};

export function IntlProvider({ children }: { children: ReactNode }) {
    // Initialize locale from localStorage or default to 'en'
    const [locale, setLocaleState] = useState<Locale>(() => {
        const savedLocale = localStorage.getItem('app_locale');
        return (savedLocale === 'en' || savedLocale === 'id') ? savedLocale : 'en';
    });

    const setLocale = (newLocale: Locale) => {
        setLocaleState(newLocale);
        localStorage.setItem('app_locale', newLocale);
    };

    return (
        <LocaleContext.Provider value={{ locale, setLocale }}>
            <ReactIntlProvider
                locale={locale}
                messages={messages[locale]}
                defaultLocale="en"
            >
                {children}
            </ReactIntlProvider>
        </LocaleContext.Provider>
    );
}

export function useLocale() {
    const context = useContext(LocaleContext);
    if (context === undefined) {
        throw new Error('useLocale must be used within an IntlProvider');
    }
    return context;
}
