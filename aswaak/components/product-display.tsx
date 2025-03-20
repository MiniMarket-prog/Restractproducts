"use client"

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Edit } from "lucide-react"
import Image from "next/image"
import type { Product } from "@/types/product"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

interface ProductDisplayProps {
  product: Product
  onEdit: () => void
}

export function ProductDisplay({ product, onEdit }: ProductDisplayProps) {
  // Updated formatDate to handle null values
  const formatDate = (dateString?: string | null): string => {
    if (!dateString) return "N/A"
    return new Date(dateString).toLocaleDateString()
  }

  // Create a default image path
  const defaultImage = "/placeholder.svg?height=200&width=200"

  // Type guard function to ensure we have a valid string
  const getValidImageSrc = (): string => {
    // If product.image exists, is a string, and doesn't start with /placeholder.svg
    if (product.image && typeof product.image === "string") {
      // If it's already a full URL (starts with http or https), use it as is
      if (product.image.startsWith("http://") || product.image.startsWith("https://")) {
        return product.image
      }
      // If it's a relative path but not the placeholder, use it
      else if (!product.image.includes("/placeholder.svg")) {
        return product.image
      }
    }
    // Otherwise use the default image
    return defaultImage
  }

  return (
    <Card className="mb-4 overflow-hidden">
      <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-6 flex justify-center">
        <Image
          src={getValidImageSrc() || "/placeholder.svg"}
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
        </div>

        <Separator />
      </CardContent>

      <CardFooter className="flex gap-2">
        <Button className="flex-1" onClick={onEdit}>
          <Edit className="mr-2 h-4 w-4" />
          Edit Product
        </Button>
      </CardFooter>
    </Card>
  )
}

