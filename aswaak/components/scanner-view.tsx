"use client"

import { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BarcodeScanner } from "@/components/barcode-scanner"
import { ManualEntry } from "@/components/manual-entry"
import { ProductDisplay } from "@/components/product-display"
import { ProductHistory } from "@/components/product-history"
import { ProductSearch } from "@/components/product-search"
import { ProductForm } from "@/components/product-form"
import type { Product, Category } from "@/types/product"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, Info } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useRouter } from "next/navigation"
import { fetchProductByBarcode, saveProduct } from "@/services/product-service"
import { fetchCategories, checkCategoriesExist, createDefaultCategoryIfNeeded } from "@/services/category-service"

interface ScannerViewProps {
  initialTab?: string | null
}

export function ScannerView({ initialTab = "scan" }: ScannerViewProps) {
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

  // Add state for duplicate product confirmation
  const [duplicateProduct, setDuplicateProduct] = useState<Product | null>(null)
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false)
  const [pendingProductData, setPendingProductData] = useState<Product | null>(null)

  // Add this function to the ScannerView component
  const debugProductData = (product: Product) => {
    console.log("Debug product data:")
    console.log("- ID:", product.id)
    console.log("- Name:", product.name)
    console.log("- Category ID:", product.category_id)
    console.log("- Category object:", product.category)
    console.log("- Categories object:", product.categories)

    // Try to extract category name
    let categoryName = null

    if (typeof product.category === "string") {
      categoryName = product.category
    } else if (product.category && typeof product.category === "object" && "name" in product.category) {
      categoryName = product.category.name
    } else if (product.categories && typeof product.categories === "object" && "name" in product.categories) {
      categoryName = product.categories.name
    }

    console.log("- Extracted category name:", categoryName)
  }

  useEffect(() => {
    // Fetch categories when component mounts
    const loadCategories = async () => {
      try {
        console.log("Loading categories in ScannerView...")
        const categoriesData = await fetchCategories()
        console.log("Categories loaded:", categoriesData)
        setCategories(categoriesData)
      } catch (err) {
        console.error("Error loading categories:", err)
        toast({
          title: "Error",
          description: "Failed to load product categories. Some features may be limited.",
          variant: "destructive",
        })
      }
    }

    // Also check if we need to create default categories
    const checkAndCreateCategories = async () => {
      try {
        const hasCategories = await checkCategoriesExist()
        if (!hasCategories) {
          await createDefaultCategoryIfNeeded()
          // Reload categories after creating defaults
          const categoriesData = await fetchCategories()
          setCategories(categoriesData)
        }
      } catch (err) {
        console.error("Error checking/creating categories:", err)
      }
    }

    loadCategories()
    checkAndCreateCategories()
  }, [toast])

  // Add this function to map category names from web sources to your database categories
  const findMatchingCategory = (categoryName: string, categories: Category[]): string | null => {
    if (!categoryName || !categories || categories.length === 0) return null

    // Convert to lowercase for case-insensitive matching
    const lowerCategoryName = categoryName.toLowerCase()

    // Try to find an exact match first
    const exactMatch = categories.find((cat) => cat.name.toLowerCase() === lowerCategoryName)
    if (exactMatch) return exactMatch.id

    // Try to find a partial match
    const partialMatch = categories.find(
      (cat) => lowerCategoryName.includes(cat.name.toLowerCase()) || cat.name.toLowerCase().includes(lowerCategoryName),
    )
    if (partialMatch) return partialMatch.id

    // No match found
    return null
  }

  // Update the handleBarcodeDetected function to set category_id when possible
  const handleBarcodeDetected = async (barcode: string) => {
    try {
      // Reset all states at the beginning of a new search
      setIsLoading(true)
      setError(null)
      setProductNotAvailable(false)
      setCurrentBarcode(barcode)
      setCurrentProduct(null)
      setWebProductInfo(null)
      setShowForm(false)
      setDuplicateProduct(null)
      setShowDuplicateDialog(false)
      setPendingProductData(null)

      // First, check if the product exists in our database
      const dbProduct = await fetchProductByBarcode(barcode)

      if (dbProduct) {
        // Product found in database
        debugProductData(dbProduct)
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
            data.price = data.price.replace(",", ".") // Replace comma with dot for decimal
          }

          // Try to match the category from the web with our database categories
          let category_id = null
          if (data.category) {
            category_id = findMatchingCategory(data.category, categories)
          }

          // Set the web product info
          setWebProductInfo({
            name: data.name,
            price: data.price,
            image: data.image,
            description: `Category: ${data.category || "Unknown"}, In Stock: ${data.isInStock ? "Yes" : "No"}`,
            category: data.category,
            category_id: category_id, // Add the matched category_id
            quantity: data.quantity || null, // Add quantity field
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

  // Add this function after the handleBarcodeDetected function
  const resetStates = () => {
    setCurrentProduct(null)
    setWebProductInfo(null)
    setIsLoading(false)
    setError(null)
    setShowForm(false)
    setCurrentBarcode("")
    setProductNotAvailable(false)
    setDuplicateProduct(null)
    setShowDuplicateDialog(false)
    setPendingProductData(null)
  }

  const handleFormCancel = () => {
    resetStates()
  }

  const handleFormSuccess = async (product: Product) => {
    try {
      setIsLoading(true)

      // Check if a product with this barcode already exists
      if (product.barcode) {
        const existingProduct = await fetchProductByBarcode(product.barcode)

        if (existingProduct && (!product.id || existingProduct.id !== product.id)) {
          // We found a different product with the same barcode
          setDuplicateProduct(existingProduct)
          setPendingProductData(product)
          setShowDuplicateDialog(true)
          setIsLoading(false)
          return
        }
      }

      // If no duplicate or user confirmed replacement, proceed with saving
      await saveProductAndUpdateUI(product)
    } catch (error) {
      toast({
        title: "Error Saving Product",
        description: `Failed to save product: ${error instanceof Error ? error.message : String(error)}`,
        variant: "destructive",
      })
      setIsLoading(false)
    }
  }

  // New function to handle the actual saving
  const saveProductAndUpdateUI = async (product: Product) => {
    try {
      setIsLoading(true)
      // Save the product to the database
      const savedProduct = await saveProduct(product)

      // Show success toast
      toast({
        title: "Product Saved",
        description: "Product has been successfully saved to the database.",
      })

      // Reset states first
      resetStates()

      // Then set the current product
      debugProductData(savedProduct)
      setCurrentProduct(savedProduct)

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
    } finally {
      setIsLoading(false)
      setShowDuplicateDialog(false)
    }
  }

  // Handle confirmation of duplicate product replacement
  const handleConfirmDuplicate = () => {
    if (pendingProductData) {
      // If the user confirms, we'll save the new product which will replace the old one
      saveProductAndUpdateUI(pendingProductData)
    }
  }

  // Handle cancellation of duplicate product replacement
  const handleCancelDuplicate = () => {
    setShowDuplicateDialog(false)
    setPendingProductData(null)
    setDuplicateProduct(null)
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

  // Replace the Tabs component with this updated version
  return (
    <div className="w-full max-w-md mx-auto flex flex-col min-h-screen">
      <Tabs defaultValue={initialTab || "scan"} className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="scan" onClick={resetStates}>
            Scan
          </TabsTrigger>
          <TabsTrigger value="search" onClick={resetStates}>
            Search
          </TabsTrigger>
          <TabsTrigger value="manual" onClick={resetStates}>
            Manual
          </TabsTrigger>
          <TabsTrigger value="history" onClick={resetStates}>
            History
          </TabsTrigger>
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
                quantity: webProductInfo?.quantity || null, // Add quantity field
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

        <TabsContent value="search" className="flex-1 flex flex-col">
          <ProductSearch
            onProductSelect={(product) => {
              setCurrentProduct(product)
              setShowForm(false)
            }}
            isLoading={isLoading}
          />

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
                quantity: webProductInfo?.quantity || null, // Add quantity field
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

      {/* Stock Update Dialog */}
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

      {/* Duplicate Product Confirmation Dialog */}
      <Dialog open={showDuplicateDialog} onOpenChange={setShowDuplicateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Duplicate Barcode Detected</DialogTitle>
            <DialogDescription>
              A product with barcode {pendingProductData?.barcode} already exists in the database.
            </DialogDescription>
          </DialogHeader>

          {duplicateProduct && (
            <div className="py-4">
              <h3 className="font-medium mb-2">Existing Product:</h3>
              <div className="bg-muted p-3 rounded-md mb-4">
                <p>
                  <strong>Name:</strong> {duplicateProduct.name}
                </p>
                <p>
                  <strong>Price:</strong> {duplicateProduct.price} DH
                </p>
                <p>
                  <strong>Stock:</strong> {duplicateProduct.stock}
                </p>
                {duplicateProduct.category && (
                  <p>
                    <strong>Category:</strong>{" "}
                    {typeof duplicateProduct.category === "string"
                      ? duplicateProduct.category
                      : duplicateProduct.category.name}
                  </p>
                )}
              </div>

              <h3 className="font-medium mb-2">New Product:</h3>
              <div className="bg-muted p-3 rounded-md">
                <p>
                  <strong>Name:</strong> {pendingProductData?.name}
                </p>
                <p>
                  <strong>Price:</strong> {pendingProductData?.price} DH
                </p>
                <p>
                  <strong>Stock:</strong> {pendingProductData?.stock}
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="flex justify-end space-x-2">
            <Button variant="outline" onClick={handleCancelDuplicate}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmDuplicate}>
              Replace Existing Product
            </Button>
          </DialogFooter>
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

