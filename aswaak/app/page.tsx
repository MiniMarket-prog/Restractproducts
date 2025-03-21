"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { ScannerView } from "@/components/scanner-view"

export default function Home() {
  const searchParams = useSearchParams()
  const tabParam = searchParams.get("tab")
  const [activeTab, setActiveTab] = useState<string | null>(null)

  useEffect(() => {
    if (tabParam && ["scan", "search", "manual", "history"].includes(tabParam)) {
      setActiveTab(tabParam)
    } else {
      setActiveTab("scan") // Default tab
    }
  }, [tabParam])

  return (
    <main className="flex min-h-screen flex-col items-center p-4">
      <ScannerView initialTab={activeTab} />
    </main>
  )
}

