"use client";
import { createContext, useCallback, useContext, useState, ReactNode } from "react";
import Flashbar, { FlashbarProps } from "@cloudscape-design/components/flashbar";

type Notify = (type: "success" | "error" | "info" | "warning", content: ReactNode, header?: ReactNode) => void;
const Ctx = createContext<{ notify: Notify; items: FlashbarProps.MessageDefinition[] }>({ notify: () => undefined, items: [] });
export const useFlash = () => useContext(Ctx).notify;
export const FlashItems = () => {
  const { items } = useContext(Ctx);
  return items.length ? <Flashbar items={items} stackItems /> : null;
};

export default function FlashProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<FlashbarProps.MessageDefinition[]>([]);
  const notify = useCallback<Notify>((type, content, header) => {
    const id = Math.random().toString(36).slice(2);
    const dismiss = () => setItems((xs) => xs.filter((x) => x.id !== id));
    setItems((xs) => [{ id, type, header, content, dismissible: true, onDismiss: dismiss }, ...xs].slice(0, 3));
  }, []);
  return <Ctx.Provider value={{ notify, items }}>{children}</Ctx.Provider>;
}
