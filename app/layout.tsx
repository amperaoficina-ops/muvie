import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "MUVI-E | Sua nova forma de rodar", template: "%s | MUVI-E" },
  description: "Scooters elétricas em São José e Palhoça, Santa Catarina.",
  robots: { index: false, follow: false },
  icons: { icon: "/brand/mark.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
