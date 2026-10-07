"use client";

import { createContext, useContext, useEffect } from "react";

export interface Crumb {
  text: string;
  href: string;
}

export interface Meta {
  breadcrumbs: Crumb[];
  fullBleed?: boolean;
}

export const MetaCtx = createContext<(meta: Meta) => void>(() => undefined);

export function usePageMeta(meta: Meta) {
  const set = useContext(MetaCtx);
  const key = JSON.stringify(meta);

  useEffect(() => {
    set(meta);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}