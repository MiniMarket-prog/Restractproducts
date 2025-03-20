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
import { fetchProductByBarcode, fetchCategories, saveProduct } from "@/services/product-service"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, Info } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useRouter } from "next/navigation"

export function ScannerView() {
  const [currentProduct, setCurrentProduct] = useState<Product | null>(null)
  const [webProductInfo, setWebProductInfo] = useState<any | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [currentBarcode, setCurrentBarcode] = useState<string>("")
  const [productNotAvailable, setProductNotAvailable] = useState(false)
  const { toast } = useToast()
  const router = useRouter()
  const [isDialogOpen, setIsDialogOpen] = useState(false)

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
      setProductNotAvailable(false)
      setCurrentBarcode(barcode)

      // Special cases for our test barcodes
      type ProductInfo = {
        name: string
        price: string
        image: string
        description: string
        category: string
      }

      // First, check if the product exists in our database
      const dbProduct = await fetchProductByBarcode(barcode)

      if (dbProduct) {
        // Product found in database
        setCurrentProduct(dbProduct)
        setWebProductInfo(null)
        setShowForm(false)
      } else {
        // Product not found in database, try to fetch from web
        try {
          console.log(`Fetching product info for barcode: ${barcode}`)
          const response = await fetch(`/api/fetch-product?barcode=${barcode}`)

          // Log the response status
          console.log(`API response status: ${response.status}`)

          // Try to parse the response as JSON
          let data
          try {
            data = await response.json()
            console.log("API response data:", data)
          } catch (parseError) {
            console.error("Error parsing API response:", parseError)
            throw new Error("Invalid API response format")
          }

          // Handle 404 response specifically
          if (response.status === 404 || data.notAvailable) {
            console.log("Product not available - 404 detected")
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
            data.price = data.price.replace(",", ".") // Replace comma with dot for decimal  {
            data.price = data.price.replace(",", ".") // Replace comma with dot for decimal
          }

          // Set the web product info
          setWebProductInfo({
            name: data.name,
            price: data.price,
            image: data.image,
            description: `Category: ${data.category || "Unknown"}, In Stock: ${data.isInStock ? "Yes" : "No"}`,
            category: data.category,
          })

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

      // Still show the form to allow manual entry
      setShowForm(true)
    } finally {
      setIsLoading(false)
    }
  }

  const handleFormCancel = () => {
    setShowForm(false)
    setWebProductInfo(null)
  }

  const handleFormSuccess = async (product: Product) => {
    try {
      // Save the product to the database
      const savedProduct = await saveProduct(product)

      // Show success toast
      toast({
        title: "Product Saved",
        description: "Product has been successfully saved to the database.",
      })

      setCurrentProduct(savedProduct)
      setShowForm(false)
      setWebProductInfo(null)

      // Add to local history
      const history = JSON.parse(localStorage.getItem("scanHistory") || "[]")
      const exists = history.some((item: Product) => item.barcode === product.barcode)

      if (!exists) {
        const updatedHistory = [product, ...history].slice(0, 50) // Keep last 50 items
        localStorage.setItem("scanHistory", JSON.stringify(updatedHistory))
      }
    } catch (error) {
      toast({
        title: "Error Saving Product",
        description: `Failed to save product: ${error instanceof Error ? error.message : String(error)}`,
        variant: "destructive",
      })
    }
  }

  const handleEditProduct = () => {
    setShowForm(true)
  }

  const handleCancelEdit = () => {
    setShowForm(false)
    setWebProductInfo(null)
  }

  const handleIncrementStock = () => {
    setIsDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setIsDialogOpen(false)
  }

  const handleStockUpdate = async (newStock: number) => {
    if (!currentProduct?.id) {
      toast({
        title: "Error",
        description: "Product ID is missing.",
        variant: "destructive",
      })
      return
    }

    try {
      setIsLoading(true)
      // Optimistically update the UI
      setCurrentProduct((prevProduct) => {
        if (prevProduct) {
          return { ...prevProduct, stock: newStock }
        }
        return prevProduct
      })

      // Call the updateProductStock function
      // await updateProductStock(currentProduct.id, newStock)

      toast({
        title: "Success",
        description: "Stock updated successfully.",
      })
      router.refresh() // Refresh the route to update server-side data
    } catch (error) {
      console.error("Error updating stock:", error)
      toast({
        title: "Error",
        description: `Failed to update stock: ${error instanceof Error ? error.message : String(error)}`,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
      setIsDialogOpen(false)
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
            <Alert variant={productNotAvailable ? "default" : "destructive"} className="mb-4">
              {productNotAvailable ? <Info className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
              <AlertTitle>{productNotAvailable ? "Product Not Available" : "Error"}</AlertTitle>
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
              isLoading={isLoading}
            />
          )}

          {currentProduct && !showForm && <ProductDisplay product={currentProduct} onEdit={() => setShowForm(true)} />}
        </TabsContent>

        <TabsContent value="manual" className="flex-1">
          <ManualEntry onSubmit={handleBarcodeDetected} isLoading={isLoading} />

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
              isLoading={isLoading}
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

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Stock</DialogTitle>
          </DialogHeader>
          <StockUpdateForm
            onUpdate={handleStockUpdate}
            onClose={handleCloseDialog}
            currentStock={currentProduct?.stock || 0}
            isLoading={isLoading}
          />
          <DialogFooter></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface StockUpdateFormProps {
  onUpdate: (newStock: number) => void
  onClose: () => void
  currentStock: number
  isLoading: boolean
}

function StockUpdateForm({ onUpdate, onClose, currentStock, isLoading }: StockUpdateFormProps) {
  const [newStock, setNewStock] = useState(currentStock)

  const handleUpdate = () => {
    onUpdate(newStock)
  }

  return (
    <div className="grid gap-4 py-4">
      <div className="grid grid-cols-4 items-center gap-4">
        <label htmlFor="stock" className="text-right">
          New Stock
        </label>
        <Input
          type="number"
          id="stock"
          value={String(newStock)}
          onChange={(e) => setNewStock(Number(e.target.value))}
          className="col-span-3"
        />
      </div>
      <div className="flex justify-end">
        <Button type="button" variant="secondary" onClick={onClose} disabled={isLoading}>
          Cancel
        </Button>
        <Button type="button" onClick={handleUpdate} disabled={isLoading}>
          Update Stock
        </Button>
      </div>
    </div>
  )
}

