"use client"

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Edit, AlertTriangle, Package } from "lucide-react"
import Image from "next/image"
import type { Product } from "@/types/product"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { StockControl } from "@/components/stock-control"
import { useState } from "react"

interface ProductDisplayProps {
  product: Product
  onEdit: () => void
}

// Changed back to named export
export function ProductDisplay({ product, onEdit }: ProductDisplayProps) {
  const [showStockControl, setShowStockControl] = useState(false)

  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A"
    return new Date(dateString).toLocaleDateString()
  }

  // Always use a string for the image source
  const imageSrc =
    product.image && typeof product.image === "string" ? product.image : "/placeholder.svg?height=200&width=200"

  return (
    <Card className="mb-4 overflow-hidden">
      <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-6 flex justify-center">
        <Image
          src={imageSrc || "/placeholder.svg?height=200&width=200"}
          alt={product.name}
          width={200}
          height={200}
          className="object-contain h-48"
        />
      </div>

      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div>
            {product.category && (
              <Badge variant="outline" className="mb-2">
                {product.category.name}
              </Badge>
            )}
            <CardTitle className="text-xl">{product.name}</CardTitle>
          </div>
          <div className="text-2xl font-bold text-primary">{product.price} DH</div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Barcode</p>
            <p className="font-medium">{product.barcode || "N/A"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Stock</p>
            <div className="flex items-center gap-2">
              <p className="font-medium">{product.stock}</p>
              {product.isLowStock && (
                <Badge variant="destructive" className="text-xs">
                  Low
                </Badge>
              )}
            </div>
          </div>
          <div>
            <p className="text-muted-foreground">Min Stock</p>
            <p className="font-medium">{product.min_stock}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Purchase Price</p>
            <p className="font-medium">{product.purchase_price?.toFixed(2) || "N/A"} DH</p>
          </div>
          <div>
            <p className="text-muted-foreground">Expiry Date</p>
            <div className="flex items-center gap-2">
              <p className="font-medium">{formatDate(product.expiry_date)}</p>
              {product.isExpiringSoon && <AlertTriangle className="h-4 w-4 text-amber-500" />}
            </div>
          </div>
          <div>
            <p className="text-muted-foreground">Notification Days</p>
            <p className="font-medium">{product.expiry_notification_days || 30}</p>
          </div>
        </div>

        {showStockControl && <StockControl product={product} onClose={() => setShowStockControl(false)} />}

        <Separator />
      </CardContent>

      <CardFooter className="flex gap-2">
        <Button className="flex-1" variant="outline" onClick={() => setShowStockControl(!showStockControl)}>
          <Package className="mr-2 h-4 w-4" />
          {showStockControl ? "Hide Stock Control" : "Stock Control"}
        </Button>
        <Button className="flex-1" onClick={onEdit}>
          <Edit className="mr-2 h-4 w-4" />
          Edit Product
        </Button>
      </CardFooter>
    </Card>
  )
}

