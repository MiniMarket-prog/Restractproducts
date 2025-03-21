import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/toaster"
import { AppSidebar } from "@/components/app-sidebar"
import { DebugPanel } from "@/components/debug-panel"
import { SettingsProvider } from "@/contexts/settings-context"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Barcode Scanner",
  description: "Scan and manage products with barcodes",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <SettingsProvider>
            <div className="flex min-h-screen flex-col md:flex-row">
              <AppSidebar />
              <main className="flex-1 overflow-y-auto">{children}</main>
            </div>
            <Toaster />
            <DebugPanel />
          </SettingsProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}

