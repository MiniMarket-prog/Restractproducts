"use client"

import { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BarcodeScanner } from "@/components/barcode-scanner"
import { ManualEntry } from "@/components/manual-entry"
import { ProductDisplay } from "@/components/product-display"
import { ProductHistory } from "@/components/product-history"
import { ProductForm } from "@/components/product-form"
import type { Product, Category } from "@/types/product"
import { AppHeader } from "@/components/app-header"
import { fetchProductByBarcode, fetchProductInfoFromWeb, fetchCategories } from "@/services/product-service"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"

export function ScannerView() {
  const [currentProduct, setCurrentProduct] = useState<Product | null>(null)
  const [webProductInfo, setWebProductInfo] = useState<any | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [currentBarcode, setCurrentBarcode] = useState<string>("")

  useEffect(() => {
    // Fetch categories when component mounts
    const loadCategories = async () => {
      try {
        const categoriesData = await fetchCategories()
        setCategories(categoriesData)
      } catch (err) {
        console.error("Error loading categories:", err)
      }
    }

    loadCategories()
  }, [])

  const handleBarcodeDetected = async (barcode: string) => {
    try {
      setIsLoading(true)
      setError(null)
      setCurrentBarcode(barcode)

      // First, check if the product exists in our database
      const dbProduct = await fetchProductByBarcode(barcode)

      if (dbProduct) {
        // Product found in database
        setCurrentProduct(dbProduct)
        setWebProductInfo(null)
        setShowForm(false)
      } else {
        // Product not found in database, try to fetch from web
        const webProduct = await fetchProductInfoFromWeb(barcode)

        if (webProduct) {
          // Product found on the web
          setWebProductInfo(webProduct)
          setCurrentProduct(null)
          setShowForm(true)
        } else {
          // Product not found anywhere
          setError(`Product with barcode ${barcode} not found`)
          setCurrentProduct(null)
          setWebProductInfo(null)

          // Still show the form to allow manual entry
          setShowForm(true)
        }
      }
    } catch (err) {
      setError(`Error: ${err instanceof Error ? err.message : String(err)}`)
      setCurrentProduct(null)
      setWebProductInfo(null)
    } finally {
      setIsLoading(false)
    }
  }

  const handleFormCancel = () => {
    setShowForm(false)
    setWebProductInfo(null)
  }

  const handleFormSuccess = (product: Product) => {
    setCurrentProduct(product)
    setShowForm(false)
    setWebProductInfo(null)

    // Add to local history
    const history = JSON.parse(localStorage.getItem("scanHistory") || "[]")
    const exists = history.some((item: Product) => item.barcode === product.barcode)

    if (!exists) {
      const updatedHistory = [product, ...history].slice(0, 50) // Keep last 50 items
      localStorage.setItem("scanHistory", JSON.stringify(updatedHistory))
    }
  }

  return (
    <div className="w-full max-w-md mx-auto flex flex-col min-h-screen">
      <AppHeader />

      <Tabs defaultValue="scan" className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="scan">Scan</TabsTrigger>
          <TabsTrigger value="manual">Manual</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="scan" className="flex-1 flex flex-col">
          <BarcodeScanner onBarcodeDetected={handleBarcodeDetected} isLoading={isLoading} />

          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {showForm && (
            <ProductForm
              initialData={{
                name: webProductInfo?.name || "",
                price: webProductInfo?.price || "",
                barcode: currentBarcode,
                stock: 0,
                min_stock: 0,
                image: webProductInfo?.image || "",
                purchase_price: 0,
                expiry_notification_days: 30,
              }}
              categories={categories}
              onCancel={handleFormCancel}
              onSuccess={handleFormSuccess}
            />
          )}

          {currentProduct && !showForm && <ProductDisplay product={currentProduct} onEdit={() => setShowForm(true)} />}
        </TabsContent>

        <TabsContent value="manual" className="flex-1">
          <ManualEntry onSubmit={handleBarcodeDetected} isLoading={isLoading} />

          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {showForm && (
            <ProductForm
              initialData={{
                name: webProductInfo?.name || "",
                price: webProductInfo?.price || "",
                barcode: currentBarcode,
                stock: 0,
                min_stock: 0,
                image: webProductInfo?.image || "",
                purchase_price: 0,
                expiry_notification_days: 30,
              }}
              categories={categories}
              onCancel={handleFormCancel}
              onSuccess={handleFormSuccess}
            />
          )}

          {currentProduct && !showForm && <ProductDisplay product={currentProduct} onEdit={() => setShowForm(true)} />}
        </TabsContent>

        <TabsContent value="history" className="flex-1">
          <ProductHistory
            onSelectProduct={(product) => {
              setCurrentProduct(product)
              setShowForm(false)
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

