"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { ManualEntry } from "@/components/manual-entry"
import { ProductDisplay } from "@/components/product-display"
import { ProductForm } from "@/components/product-form"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, Info, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { fetchProductByBarcode, saveProduct } from "@/services/product-service"
import { fetchCategories } from "@/services/category-service"
import { useSettings } from "@/contexts/settings-context"
import type { Product } from "@/types/product"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

export default function ManualPage() {
  const [currentProduct, setCurrentProduct] = useState<Product | null>(null)
  const [webProductInfo, setWebProductInfo] = useState<any | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [categories, setCategories] = useState<any[]>([])
  const [currentBarcode, setCurrentBarcode] = useState<string>("")
  const [productNotAvailable, setProductNotAvailable] = useState(false)
  // Add state for existing product dialog
  const [existingProduct, setExistingProduct] = useState<Product | null>(null)
  const [showExistingProductDialog, setShowExistingProductDialog] = useState(false)
  const { toast } = useToast()
  const { settings } = useSettings()
  const searchParams = useSearchParams()

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const categoriesData = await fetchCategories()
        setCategories(categoriesData)
      } catch (err) {
        console.error("Error loading categories:", err)
      }
    }

    loadCategories()

    // Check if barcode is provided in URL
    const barcodeParam = searchParams.get("barcode")
    if (barcodeParam) {
      handleBarcodeDetected(barcodeParam)
    }
  }, [searchParams])

  const handleBarcodeDetected = async (barcode: string) => {
    try {
      setIsLoading(true)
      setError(null)
      setProductNotAvailable(false)
      setCurrentBarcode(barcode)
      setCurrentProduct(null)
      setWebProductInfo(null)
      setShowForm(false)

      // First, check if the product exists in our database
      const dbProduct = await fetchProductByBarcode(barcode)

      if (dbProduct) {
        // Product found in database - show the existing product dialog
        setExistingProduct(dbProduct)
        setShowExistingProductDialog(true)
      } else {
        // Product not found in database, try to fetch from web
        try {
          const response = await fetch(`/api/fetch-product?barcode=${barcode}`)

          let data
          try {
            data = await response.json()
          } catch (parseError) {
            throw new Error("Invalid API response format")
          }

          // Handle 404 response specifically
          if (response.status === 404 || data.notAvailable) {
            setProductNotAvailable(true)
            setError(`Product with barcode ${barcode} is not available in Aswak Assalam`)
            toast({
              title: "Product Not Available",
              description: "This product is not available in Aswak Assalam.",
              variant: "destructive",
            })

            // Still show the form to allow manual entry
            setShowForm(true)
            setWebProductInfo(null)
            return
          }

          if (!response.ok) {
            throw new Error(`API error: ${data.message || "Unknown error"}`)
          }

          // Format the price to ensure it's displayed correctly
          if (data.price) {
            data.price = data.price.replace(",", ".")
          }

          // Try to match the category from the web with our database categories
          let category_id = null
          if (data.category && categories.length > 0) {
            const matchingCategory = categories.find(
              (cat) =>
                cat.name.toLowerCase() === data.category.toLowerCase() ||
                data.category.toLowerCase().includes(cat.name.toLowerCase()),
            )
            if (matchingCategory) category_id = matchingCategory.id
          }

          // Set the web product info - Make sure to preserve the image URL exactly as received
          setWebProductInfo({
            name: data.name,
            // ALWAYS use the default selling price from settings
            price: settings.inventory.defaultSellingPrice,
            image: data.image, // Preserve the image URL exactly as received
            description: `Category: ${data.category || "Unknown"}, In Stock: ${data.isInStock ? "Yes" : "No"}`,
            category: data.category,
            // Only use the matched category if it exists, otherwise use default
            category_id: category_id || settings.inventory.defaultCategoryId,
            quantity: data.quantity || null,
            // Add default purchase price from settings
            purchase_price: settings.inventory.defaultPurchasePrice,
          })

          console.log("Web product info with image:", data.image) // Add this debug log

          setCurrentProduct(null)
          setShowForm(true)
        } catch (err) {
          console.error("Error fetching product from web:", err)

          // Check if this is a 404 error
          if (err instanceof Error && err.message.includes("404")) {
            setProductNotAvailable(true)
            setError(`Product with barcode ${barcode} is not available in Aswak Assalam`)
            toast({
              title: "Product Not Available",
              description: "This product is not available in Aswak Assalam.",
              variant: "destructive",
            })
          } else {
            setError(`Error: ${err instanceof Error ? err.message : String(err)}`)
          }

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
      setShowForm(true)
    } finally {
      setIsLoading(false)
    }
  }

  const handleFormCancel = () => {
    setCurrentProduct(null)
    setWebProductInfo(null)
    setError(null)
    setShowForm(false)
    setCurrentBarcode("")
    setProductNotAvailable(false)
  }

  // Update the handleFormSuccess function to ensure the image URL is preserved
  const handleFormSuccess = async (product: Product) => {
    try {
      setIsLoading(true)

      // Ensure the image URL is preserved
      if (!product.image && webProductInfo?.image) {
        product.image = webProductInfo.image
      }

      // Log the product being saved
      console.log("Saving product with image:", product.image)

      const savedProduct = await saveProduct(product)

      toast({
        title: "Product Saved",
        description: "Product has been successfully saved to the database.",
      })

      // Log the saved product
      console.log("Saved product with image:", savedProduct.image)

      setCurrentProduct(savedProduct)
      setWebProductInfo(null)
      setError(null)
      setShowForm(false)

      // Update history
      const history = JSON.parse(localStorage.getItem("scanHistory") || "[]")
      const historyEntry = {
        ...savedProduct,
        created_at: savedProduct.created_at || new Date().toISOString(),
      }

      const existingIndex = history.findIndex(
        (item: Product) =>
          (item.barcode && item.barcode === savedProduct.barcode) || (item.id && item.id === savedProduct.id),
      )

      let updatedHistory = [...history]
      if (existingIndex >= 0) {
        updatedHistory[existingIndex] = historyEntry
      } else {
        updatedHistory = [historyEntry, ...history]
      }

      updatedHistory = updatedHistory.slice(0, 50)
      localStorage.setItem("scanHistory", JSON.stringify(updatedHistory))
    } catch (error) {
      toast({
        title: "Error Saving Product",
        description: `Failed to save product: ${error instanceof Error ? error.message : String(error)}`,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Handle edit button click in the existing product dialog
  const handleEditExistingProduct = () => {
    if (existingProduct) {
      setCurrentProduct(existingProduct)
      setShowForm(true)
      setShowExistingProductDialog(false)
    }
  }

  // Handle cancel button click in the existing product dialog
  const handleCancelExistingProduct = () => {
    setShowExistingProductDialog(false)
    setCurrentProduct(null)
    setWebProductInfo(null)
    setError(null)
    setShowForm(false)
    setCurrentBarcode("")
    setProductNotAvailable(false)
  }

  // Handle view details button click in the existing product dialog
  const handleViewExistingProduct = () => {
    if (existingProduct) {
      setCurrentProduct(existingProduct)
      setShowExistingProductDialog(false)
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center p-4">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold mb-4">Manual Entry</h1>

        {isLoading && searchParams.get("barcode") ? (
          <div className="flex justify-center items-center p-8">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p>Searching for barcode {searchParams.get("barcode")}...</p>
            </div>
          </div>
        ) : (
          <ManualEntry onSubmit={handleBarcodeDetected} isLoading={isLoading} />
        )}

        {error && (
          <Alert variant={productNotAvailable ? "default" : "destructive"} className="mb-4">
            {productNotAvailable ? <Info className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            <AlertTitle>{productNotAvailable ? "Product Not Available" : "Error"}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {showForm && (
          <ProductForm
            initialData={{
              ...currentProduct, // Add this to include all existing product data
              name: currentProduct?.name || webProductInfo?.name || "",
              price: currentProduct?.price || webProductInfo?.price || settings.inventory.defaultSellingPrice || "",
              barcode: currentProduct?.barcode || currentBarcode,
              stock: currentProduct?.stock || settings?.inventory?.defaultStock || 0,
              min_stock: currentProduct?.min_stock || settings?.inventory?.defaultMinStock || 0,
              image: currentProduct?.image || webProductInfo?.image || "",
              purchase_price:
                currentProduct?.purchase_price ||
                webProductInfo?.purchase_price ||
                settings.inventory.defaultPurchasePrice ||
                "",
              quantity: currentProduct?.quantity || webProductInfo?.quantity || null,
              category_id:
                currentProduct?.category_id ||
                webProductInfo?.category_id ||
                settings.inventory.defaultCategoryId ||
                "",
              expiry_notification_days: currentProduct?.expiry_notification_days || 30,
            }}
            categories={categories}
            onCancel={handleFormCancel}
            onSuccess={handleFormSuccess}
            isLoading={isLoading}
          />
        )}

        {currentProduct && !showForm && <ProductDisplay product={currentProduct} onEdit={() => setShowForm(true)} />}
      </div>
      {/* Existing Product Dialog */}
      <Dialog open={showExistingProductDialog} onOpenChange={setShowExistingProductDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Product Already Exists</DialogTitle>
            <DialogDescription>
              A product with barcode {existingProduct?.barcode} already exists in the database.
            </DialogDescription>
          </DialogHeader>

          {existingProduct && (
            <div className="py-4">
              <div className="bg-muted p-3 rounded-md mb-4">
                <p className="font-medium text-lg mb-2">{existingProduct.name}</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <p>
                    <strong>Price:</strong> {existingProduct.price} DH
                  </p>
                  <p>
                    <strong>Stock:</strong> {existingProduct.stock}
                  </p>
                  {existingProduct.purchase_price && (
                    <p>
                      <strong>Purchase Price:</strong> {existingProduct.purchase_price} DH
                    </p>
                  )}
                  {existingProduct.category && (
                    <p>
                      <strong>Category:</strong>{" "}
                      {typeof existingProduct.category === "string"
                        ? existingProduct.category
                        : existingProduct.category.name}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex justify-between">
            <Button variant="outline" onClick={handleCancelExistingProduct}>
              Cancel
            </Button>
            <div className="space-x-2">
              <Button variant="secondary" onClick={handleViewExistingProduct}>
                View Details
              </Button>
              <Button onClick={handleEditExistingProduct}>Edit Product</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}

