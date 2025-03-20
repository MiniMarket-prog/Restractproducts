"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Product } from "@/types/product"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Trash2, AlertTriangle, PackageCheck } from "lucide-react"
import Image from "next/image"

interface ProductHistoryProps {
  onSelectProduct: (product: Product) => void
}

export function ProductHistory({ onSelectProduct }: ProductHistoryProps) {
  const [history, setHistory] = useState<Product[]>([])

  useEffect(() => {
    const savedHistory = localStorage.getItem("scanHistory")
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory))
      } catch (err) {
        console.error("Error parsing history:", err)
      }
    }
  }, [])

  const clearHistory = () => {
    localStorage.removeItem("scanHistory")
    setHistory([])
  }

  // Default image path
  const defaultImage = "/placeholder.svg?height=48&width=48"

  if (history.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <PackageCheck className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No scan history yet</p>
          <p className="text-sm text-muted-foreground mt-2">Scanned products will appear here</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Recent Scans</CardTitle>
        <Button variant="ghost" size="sm" onClick={clearHistory}>
          <Trash2 className="h-4 w-4 mr-2" />
          Clear
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[400px]">
          {history.map((product) => {
            // Always use a string for the image source
            const imageSrc = typeof product.image === "string" ? product.image : "/placeholder.svg?height=48&width=48"

            return (
              <div
                key={`${product.barcode || "unknown"}-${product.id || Date.now()}`}
                className="flex items-center p-4 border-b hover:bg-muted/50 cursor-pointer"
                onClick={() => onSelectProduct(product)}
              >
                <div className="w-12 h-12 mr-4 relative flex-shrink-0">
                  <Image src={imageSrc || "/placeholder.svg"} alt={product.name} fill className="object-contain" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium truncate">{product.name}</h4>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>{product.barcode || "No barcode"}</span>
                    <span>{product.price} DH</span>
                  </div>
                </div>
                {(product.isLowStock || product.isExpiringSoon) && (
                  <AlertTriangle className="h-4 w-4 text-amber-500 ml-2" />
                )}
              </div>
            )
          })}
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

