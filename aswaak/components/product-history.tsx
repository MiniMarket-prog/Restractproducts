"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Product } from "@/types/product"

interface ProductHistoryProps {
  onSelectProduct: (product: Product) => void
}

export function ProductHistory({ onSelectProduct }: ProductHistoryProps) {
  const [history, setHistory] = useState<Product[]>([])

  useEffect(() => {
    // Load scan history from local storage
    const storedHistory = localStorage.getItem("scanHistory")
    if (storedHistory) {
      setHistory(JSON.parse(storedHistory))
    }
  }, [])

  const handleProductClick = (product: Product) => {
    onSelectProduct(product)
  }

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle>Scan History</CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recent scans</p>
        ) : (
          <div className="space-y-2">
            {history.map((product) => (
              <div
                key={product.barcode}
                className="p-2 border rounded-md cursor-pointer hover:bg-accent"
                onClick={() => handleProductClick(product)}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">{product.name}</p>
                    <p className="text-sm text-muted-foreground">Barcode: {product.barcode}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{product.price} DH</p>
                    <p className="text-sm">Stock: {product.stock}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

