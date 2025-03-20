"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { Product } from "@/types/product"
import { updateProductStock } from "@/services/product-service"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Plus, Minus } from "lucide-react"

interface StockControlProps {
  product: Product
  onClose: () => void
}

export function StockControl({ product, onClose }: StockControlProps) {
  const [quantity, setQuantity] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const handleStockChange = async (action: "add" | "remove") => {
    if (!product.id) return

    try {
      setIsLoading(true)

      const newStock = action === "add" ? product.stock + quantity : Math.max(0, product.stock - quantity)

      await updateProductStock(product.id, newStock)

      // Update the product in the UI
      product.stock = newStock
      product.isLowStock = newStock <= product.min_stock

      toast({
        title: "Stock Updated",
        description: `Stock ${action === "add" ? "increased" : "decreased"} by ${quantity}`,
      })

      // Close the stock control panel
      onClose()
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to update stock: ${error instanceof Error ? error.message : String(error)}`,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="border rounded-lg p-4 space-y-4">
      <div className="space-y-2">
        <Label htmlFor="quantity">Quantity</Label>
        <div className="flex items-center">
          <Button type="button" variant="outline" size="icon" onClick={() => setQuantity(Math.max(1, quantity - 1))}>
            <Minus className="h-4 w-4" />
          </Button>
          <Input
            id="quantity"
            type="number"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(Number.parseInt(e.target.value) || 1)}
            className="mx-2 text-center"
          />
          <Button type="button" variant="outline" size="icon" onClick={() => setQuantity(quantity + 1)}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex gap-2">
        <Button className="flex-1" variant="outline" onClick={() => handleStockChange("add")} disabled={isLoading}>
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Plus className="mr-2 h-4 w-4" />
              Add Stock
            </>
          )}
        </Button>
        <Button
          className="flex-1"
          variant="outline"
          onClick={() => handleStockChange("remove")}
          disabled={isLoading || product.stock <= 0}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Minus className="mr-2 h-4 w-4" />
              Remove Stock
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

