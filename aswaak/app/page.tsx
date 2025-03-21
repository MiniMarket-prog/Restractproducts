"use client"

import { SystemStatusDashboard } from "@/components/system-status"
import { QuickActions } from "@/components/quick-actions"
import { RecentActivity } from "@/components/recent-activity"
import { ScannerView } from "@/components/scanner-view"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useSettings } from "@/contexts/settings-context"
import { useSearchParams } from "next/navigation"

export default function Home() {
  const { settings } = useSettings()
  const searchParams = useSearchParams()

  // Check if debug mode is enabled in settings
  const isDebugMode = settings?.advanced?.debugMode || false

  // Get the tab from URL parameters or use default
  const tabParam = searchParams.get("tab")
  const defaultTab = tabParam === "scan" ? "scan" : isDebugMode ? "dashboard" : "scan"

  return (
    <main className="flex min-h-screen flex-col items-center p-4">
      <div className="w-full max-w-6xl">
        <h1 className="text-2xl font-bold mb-4">Barcode Scanner Dashboard</h1>

        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="scan">Scan Barcode</TabsTrigger>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          </TabsList>

          <TabsContent value="scan" className="mt-4">
            <div className="w-full max-w-md mx-auto">
              <ScannerView />
            </div>
          </TabsContent>

          <TabsContent value="dashboard" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-6">
                <QuickActions />
                <RecentActivity />
              </div>
              <div>
                <SystemStatusDashboard />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  )
}

