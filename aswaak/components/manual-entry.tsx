"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Barcode } from "lucide-react"

interface ManualEntryProps {
  onSubmit: (barcode: string) => void
  isLoading: boolean
}

export function ManualEntry({ onSubmit, isLoading }: ManualEntryProps) {
  const [barcode, setBarcode] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (barcode.trim()) {
      onSubmit(barcode.trim())
    }
  }

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle className="text-lg">Manual Entry</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col space-y-2">
            <Input
              type="text"
              placeholder="Enter barcode"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <Button type="submit" className="w-full" disabled={isLoading || !barcode.trim()}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <Barcode className="mr-2 h-4 w-4" />
                Search Barcode
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

