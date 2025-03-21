"use client"

import { Button } from "@/components/ui/button"
import { Settings } from "lucide-react"
import Link from "next/link"

export function AppHeader() {
  return (
    <header className="w-full py-4 px-2 flex justify-between items-center border-b mb-4">
      <h1 className="text-xl font-bold">Barcode Scanner</h1>
      <Link href="/settings">
        <Button variant="ghost" size="icon" title="Settings">
          <Settings className="h-5 w-5" />
        </Button>
      </Link>
    </header>
  )
}

