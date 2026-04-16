import { createContext, useContext, useState, ReactNode } from 'react';
import { es } from './es';

type Lang = 'en' | 'es';

interface I18nContext {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
}

const Ctx = createContext<I18nContext>({
  lang: 'en',
  setLang: () => {},
  t: (k) => k,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const stored = localStorage.getItem('lang');
    return stored === 'es' ? 'es' : 'en';
  });

  function setLang(l: Lang) {
    setLangState(l);
    localStorage.setItem('lang', l);
  }

  function t(key: string): string {
    if (lang === 'en') return key;
    return es[key] ?? key;
  }

  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}

export function useLang() {
  return useContext(Ctx);
}
