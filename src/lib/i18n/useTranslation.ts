"use client";

import { useCallback } from "react";
import ptStrings from "./pt.json";
import enStrings from "./en.json";

type Lang = "pt" | "en";
type StringKey = keyof typeof ptStrings;

const strings: Record<Lang, Record<string, string>> = {
  pt: ptStrings,
  en: enStrings,
};

export function useTranslation(lang: Lang = "pt") {
  const t = useCallback(
    (key: StringKey): string => {
      return strings[lang]?.[key] ?? strings.pt[key] ?? key;
    },
    [lang]
  );

  return { t };
}
