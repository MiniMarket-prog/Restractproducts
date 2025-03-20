"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"

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
        <CardTitle className="text-lg">Enter Barcode Manually</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="barcode">Barcode</Label>
            <Input
              id="barcode"
              placeholder="e.g. 6111245591063"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              disabled={isLoading}
              pattern="[0-9]*"
              inputMode="numeric"
            />
          </div>
          <Button type="submit" className="w-full" disabled={isLoading || !barcode.trim()}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Searching...
              </>
            ) : (
              "Search Product"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

