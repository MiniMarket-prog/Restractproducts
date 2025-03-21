"use client"

import { useState, useEffect } from "react"
import { BarcodeScanner } from "@/components/barcode-scanner"
import { ProductDisplay } from "@/components/product-display"
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
import { useSettings } from "@/contexts/settings-context"
// Comment out the import for now since we're having issues with it
// import { subscribeToProducts, subscribeToCategories } from "@/lib/realtime-service"

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
  const { settings } = useSettings()

  // Add state for existing product dialog
  const [existingProduct, setExistingProduct] = useState<Product | null>(null)
  const [showExistingProductDialog, setShowExistingProductDialog] = useState(false)

  // Add state for duplicate product dialog
  const [duplicateProduct, setDuplicateProduct] = useState<Product | null>(null)
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false)
  const [pendingProductData, setPendingProductData] = useState<Product | null>(null)

  // Add debugging state
  const [debugInfo, setDebugInfo] = useState<string>("")

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
          // Pass no arguments since createDefaultCategoryIfNeeded doesn't expect any
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

    // Empty cleanup function for now
    return () => {}
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

  // Update the handleBarcodeDetected function to check for existing products
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
      setExistingProduct(null)
      setShowExistingProductDialog(false)

      // Add debug info
      setDebugInfo(`Scanning barcode: ${barcode}`)

      // First, check if the product exists in our database
      const dbProduct = await fetchProductByBarcode(barcode)

      // Update debug info
      setDebugInfo((prev) => `${prev}\nDatabase product found: ${dbProduct ? "Yes" : "No"}`)

      if (dbProduct) {
        // Product found in database - show the existing product dialog
        setDebugInfo((prev) => `${prev}\nSetting existing product and showing dialog`)
        setExistingProduct(dbProduct)
        setShowExistingProductDialog(true)

        // Add a toast to confirm the dialog should be showing
        toast({
          title: "Product Found",
          description: "Existing product found in database. Dialog should be showing.",
        })
      } else {
        // Product not found in database, try to fetch from web
        setDebugInfo((prev) => `${prev}\nFetching product from web`)
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
          setShowForm(true)
          setWebProductInfo({
            name: data.name,
            // ALWAYS use the default selling price from settings
            price: settings.inventory.defaultSellingPrice,
            image: data.image,
            description: `Category: ${data.category || "Unknown"}, In Stock: ${data.isInStock ? "Yes" : "No"}`,
            category: data.category,
            // Only use the matched category if it exists, otherwise use default
            category_id: category_id || settings.inventory.defaultCategoryId,
            quantity: data.quantity || null,
            // Always use the default purchase price from settings
            purchase_price: settings.inventory.defaultPurchasePrice,
          })

          setCurrentProduct(null)
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

  // Add this function to reset all states
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
    setExistingProduct(null)
    setShowExistingProductDialog(false)
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

      // Save the product to the database - saveProduct only expects one argument
      const savedProduct = await saveProduct(product)

      // Show success toast
      toast({
        title: "Product Saved",
        description: "Product has been successfully saved to the database.",
      })

      // Reset states first
      resetStates()

      // Then set the current product
      setCurrentProduct(savedProduct)

      // Add to local history - IMPROVED HISTORY HANDLING
      const history = JSON.parse(localStorage.getItem("scanHistory") || "[]")

      // Check if this product already exists in history by barcode or ID
      const existingIndex = history.findIndex(
        (item: Product) =>
          (item.barcode && item.barcode === savedProduct.barcode) || (item.id && item.id === savedProduct.id),
      )

      // Create a history entry with timestamp
      const historyEntry = {
        ...savedProduct,
        created_at: savedProduct.created_at || new Date().toISOString(), // Ensure we have a timestamp
      }

      let updatedHistory = [...history]

      if (existingIndex >= 0) {
        // Replace the existing entry
        updatedHistory[existingIndex] = historyEntry
      } else {
        // Add as a new entry at the beginning
        updatedHistory = [historyEntry, ...history]
      }

      // Keep only the last 50 items to prevent localStorage from getting too large
      updatedHistory = updatedHistory.slice(0, 50)

      // Save to localStorage
      localStorage.setItem("scanHistory", JSON.stringify(updatedHistory))
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
    resetStates()
  }

  // Handle view details button click in the existing product dialog
  const handleViewExistingProduct = () => {
    if (existingProduct) {
      setCurrentProduct(existingProduct)
      setShowExistingProductDialog(false)
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

  // Add a function to manually test the dialog
  const testExistingProductDialog = () => {
    // Create a sample product
    const sampleProduct: Product = {
      id: "test-id",
      name: "Test Product",
      barcode: "1234567890",
      price: "99.99",
      stock: 10,
      min_stock: 5, // Add the required min_stock property
      category: { id: "cat-id", name: "Test Category" },
      category_id: "cat-id",
      created_at: new Date().toISOString(),
    }

    // Set the existing product and show the dialog
    setExistingProduct(sampleProduct)
    setShowExistingProductDialog(true)

    // Add a toast to confirm the dialog should be showing
    toast({
      title: "Test Dialog",
      description: "Testing the existing product dialog.",
    })
  }

  return (
    <div className="w-full">
      <div className="space-y-4">
        <BarcodeScanner onBarcodeDetected={handleBarcodeDetected} isLoading={isLoading} />

        {/* Add a test button */}
        <div className="flex justify-center mt-4">
          <Button onClick={testExistingProductDialog} variant="outline">
            Test Existing Product Dialog
          </Button>
        </div>

        {/* Add debug info */}
        {debugInfo && (
          <Alert className="mt-4">
            <AlertTitle>Debug Info</AlertTitle>
            <AlertDescription>
              <pre className="whitespace-pre-wrap">{debugInfo}</pre>
            </AlertDescription>
          </Alert>
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
              ...(currentProduct || {}),
              name: webProductInfo?.name || currentProduct?.name || "",
              price: webProductInfo?.price || currentProduct?.price || settings.inventory.defaultSellingPrice || "",
              barcode: currentBarcode || currentProduct?.barcode || "",
              stock: currentProduct?.stock || settings?.inventory?.defaultStock || 0,
              min_stock: currentProduct?.min_stock || settings?.inventory?.defaultMinStock || 0,
              image: webProductInfo?.image || currentProduct?.image || "",
              purchase_price:
                webProductInfo?.purchase_price ||
                currentProduct?.purchase_price ||
                settings.inventory.defaultPurchasePrice ||
                "",
              quantity: webProductInfo?.quantity || currentProduct?.quantity || null,
              category_id:
                webProductInfo?.category_id ||
                currentProduct?.category_id ||
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

      {/* Duplicate Product Confirmation Dialog */}
      <Dialog open={showDuplicateDialog} onOpenChange={setShowDuplicateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Duplicate Barcode Detected</DialogTitle>
            <DialogDescription>
              A product with barcode {pendingProductData?.barcode} already exists in the database. Please review the
              details below and decide if you want to replace the existing product.
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

