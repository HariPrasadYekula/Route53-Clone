import type { ReactNode } from "react";
import Shell from "@/components/Shell";

export default function Route53Layout({ children }: { children: ReactNode }) {
  return <Shell>{children}</Shell>;
}
