import "@cloudscape-design/global-styles/index.css";
import "./globals.css";
import type { ReactNode } from "react";
import Providers from "@/components/Providers";

export const metadata = { title: "Route 53 | Global", icons: { icon: "/route53-icon.svg" } };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
