"use client";
import { ReactNode, useEffect } from "react";
import AuthProvider from "./AuthProvider";
import FlashProvider from "./FlashProvider";
import { applyAwsTheme } from "@/lib/theme";

export default function Providers({ children }: { children: ReactNode }) {
  useEffect(() => applyAwsTheme().reset, []);
  return (
    <AuthProvider>
      <FlashProvider>{children}</FlashProvider>
    </AuthProvider>
  );
}
