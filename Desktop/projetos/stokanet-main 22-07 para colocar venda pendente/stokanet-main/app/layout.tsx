import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { getServerSession } from "next-auth";
import "./globals.css";
import { Providers } from "@/components/Providers";
import prisma from "@/lib/prisma";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { toThemeAttribute } from "@/lib/theme";

const font = Plus_Jakarta_Sans({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "StokaNet",
  description: "Sistema de controle de estoque para lojas de qualquer segmento, com produtos, variações e reposições.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let themeAttribute = toThemeAttribute(null)

  try {
    const session = await getServerSession(authOptions)
    const sessionUser = session?.user as { id?: string; authExpiresAt?: number | null } | undefined
    // Date.now is intentionally used to check session expiration on server render.
    const userId = sessionUser?.id && (!sessionUser.authExpiresAt || Date.now() <= sessionUser.authExpiresAt) ? sessionUser.id : undefined

    const userThemePreference = userId
      ? await prisma.user.findUnique({
          where: { id: userId },
          select: { themePreference: true },
        })
      : null

    themeAttribute = toThemeAttribute(userThemePreference?.themePreference)
  } catch {
    themeAttribute = toThemeAttribute(null)
  }

  return (
    <html lang="pt-BR" className="dark h-full antialiased" data-theme-color={themeAttribute}>
      <body className={`${font.className} min-h-full flex flex-col`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}

