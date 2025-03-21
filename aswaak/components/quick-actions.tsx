"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import { Barcode, Search, ClipboardList, Clock, Settings, Tag, Loader2 } from "lucide-react"

export function QuickActions() {
  const [barcode, setBarcode] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()
  const router = useRouter()

  const handleQuickScan = () => {
    if (!barcode.trim()) {
      toast({
        title: "Error",
        description: "Please enter a barcode",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)

    // Redirect to manual page with the barcode
    router.push(`/manual?barcode=${barcode.trim()}`)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
        <CardDescription>Quickly access common functions</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Enter barcode"
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            className="flex-1"
          />
          <Button onClick={handleQuickScan} disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            <span className="sr-only md:not-sr-only md:ml-2">Search</span>
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          <Button variant="outline" className="flex flex-col h-auto py-4" onClick={() => router.push("/")}>
            <Barcode className="h-5 w-5 mb-1" />
            <span>Scan</span>
          </Button>
          <Button variant="outline" className="flex flex-col h-auto py-4" onClick={() => router.push("/manual")}>
            <ClipboardList className="h-5 w-5 mb-1" />
            <span>Manual</span>
          </Button>
          <Button variant="outline" className="flex flex-col h-auto py-4" onClick={() => router.push("/search")}>
            <Search className="h-5 w-5 mb-1" />
            <span>Search</span>
          </Button>
          <Button variant="outline" className="flex flex-col h-auto py-4" onClick={() => router.push("/history")}>
            <Clock className="h-5 w-5 mb-1" />
            <span>History</span>
          </Button>
          <Button
            variant="outline"
            className="flex flex-col h-auto py-4"
            onClick={() => router.push("/settings?tab=categories")}
          >
            <Tag className="h-5 w-5 mb-1" />
            <span>Categories</span>
          </Button>
          <Button variant="outline" className="flex flex-col h-auto py-4" onClick={() => router.push("/settings")}>
            <Settings className="h-5 w-5 mb-1" />
            <span>Settings</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

