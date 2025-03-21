"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useRouter } from "next/navigation"
import { Clock, Package, ArrowRight, AlertTriangle } from "lucide-react"
import type { Product } from "@/types/product"

export function RecentActivity() {
  const [recentProducts, setRecentProducts] = useState<Product[]>([])
  const router = useRouter()

  useEffect(() => {
    // Load recent products from localStorage
    const loadRecentProducts = () => {
      try {
        const storedHistory = localStorage.getItem("scanHistory")
        if (storedHistory) {
          const parsedHistory = JSON.parse(storedHistory) as Product[]
          // Take only the 5 most recent products
          setRecentProducts(parsedHistory.slice(0, 5))
        }
      } catch (error) {
        console.error("Error loading recent products:", error)
      }
    }

    loadRecentProducts()
  }, [])

  // Format date for display
  const formatDate = (dateString?: string) => {
    if (!dateString) return "Unknown date"

    try {
      const date = new Date(dateString)
      return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    } catch (e) {
      return "Invalid date"
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>Your recently scanned products</CardDescription>
      </CardHeader>
      <CardContent>
        {recentProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <AlertTriangle className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-muted-foreground">No recent activity found</p>
            <p className="text-sm text-muted-foreground">Scan some products to see them here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentProducts.map((product, index) => (
              <div
                key={`${product.id || product.barcode}-${index}`}
                className="flex items-center justify-between p-2 border rounded-md"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{product.name}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{product.barcode || "No barcode"}</span>
                    {product.created_at && (
                      <>
                        <span>•</span>
                        <span className="flex items-center">
                          <Clock className="h-3 w-3 mr-1" />
                          {formatDate(product.created_at)}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{product.price} DH</Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => router.push(`/history?product=${product.id || product.barcode}`)}
                  >
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {recentProducts.length > 0 && (
          <Button variant="outline" className="w-full mt-4" onClick={() => router.push("/history")}>
            <Package className="h-4 w-4 mr-2" />
            View All History
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

