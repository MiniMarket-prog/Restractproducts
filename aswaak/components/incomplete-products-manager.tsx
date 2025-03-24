"use client"

import { useState, useEffect } from "react"
import { fetchProductInfoFromWeb, saveProduct } from "@/services/product-service"
import type { Product } from "@/types/product"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Loader2, Search, Save, ImageIcon, Package, ScanBarcodeIcon as BarcodeScan, AlertCircle } from "lucide-react"
import { supabase, isSupabaseInitialized } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"

interface ProcessingResult {
  product: Product
  success: boolean
  error?: string
}

export function IncompleteProductsManager() {
  const [products, setProducts] = useState<Product[]>([])
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [batchSize, setBatchSize] = useState(10)
  const [currentBatch, setCurrentBatch] = useState<Product[]>([])
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [fetchingInfo, setFetchingInfo] = useState(false)
  const [batchProcessing, setBatchProcessing] = useState(false)
  const [processingProgress, setProcessingProgress] = useState(0)
  const [processingResults, setProcessingResults] = useState<ProcessingResult[]>([])
  const [showResults, setShowResults] = useState(false)
  const [filters, setFilters] = useState({
    missingName: false,
    missingImage: false,
    missingStock: false,
    missingMinStock: false,
  })
  const { toast } = useToast()

  const [batchUpdateOptions, setBatchUpdateOptions] = useState({
    updateName: true,
    updateImage: true,
    updatePrice: true,
    updateStock: true,
    updateMinStock: true,
  })
  const [defaultStockValue, setDefaultStockValue] = useState(0)
  const [defaultMinStockValue, setDefaultMinStockValue] = useState(5)

  // Fetch all products on component mount
  useEffect(() => {
    fetchProducts()
  }, [])

  // Filter products when search query or filters change
  useEffect(() => {
    filterProducts()
  }, [products, searchQuery, filters])

  // Update current batch when filtered products or batch size changes
  useEffect(() => {
    updateCurrentBatch()
  }, [filteredProducts, batchSize])

  async function fetchProducts() {
    setLoading(true)
    try {
      if (!isSupabaseInitialized()) {
        toast({
          title: "Database not available",
          description: "Using mock data instead",
          variant: "destructive",
        })
        setProducts([])
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from("products")
        .select("*, categories:category_id(*)")
        .order("created_at", { ascending: false })

      if (error) {
        throw error
      }

      // Transform the data to match our Product interface
      const transformedProducts = data.map((item: any) => ({
        ...item,
        category: item.categories,
        isLowStock:
          typeof item.stock === "number" && typeof item.min_stock === "number" ? item.stock <= item.min_stock : false,
        isExpiringSoon: item.expiry_date
          ? isExpiringSoon(item.expiry_date, item.expiry_notification_days || 30)
          : false,
      })) as Product[]

      setProducts(transformedProducts)
    } catch (error) {
      console.error("Error fetching products:", error)
      toast({
        title: "Failed to fetch products",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  function filterProducts() {
    let filtered = [...products]

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (product) =>
          product.name?.toLowerCase().includes(query) ||
          false ||
          product.barcode?.toLowerCase().includes(query) ||
          false,
      )
    }

    // Apply missing data filters
    if (filters.missingName) {
      filtered = filtered.filter((product) => !product.name || product.name.trim() === "")
    }

    if (filters.missingImage) {
      filtered = filtered.filter((product) => !product.image || product.image.includes("placeholder"))
    }

    if (filters.missingStock) {
      filtered = filtered.filter((product) => product.stock === undefined || product.stock === null)
    }

    if (filters.missingMinStock) {
      filtered = filtered.filter((product) => product.min_stock === undefined || product.min_stock === null)
    }

    setFilteredProducts(filtered)
  }

  function updateCurrentBatch() {
    setCurrentBatch(filteredProducts.slice(0, batchSize))
  }

  async function handleFetchInfo(product: Product) {
    if (!product.barcode) {
      toast({
        title: "Barcode required",
        description: "Cannot fetch product info without a barcode",
        variant: "destructive",
      })
      return
    }

    setFetchingInfo(true)
    try {
      const productInfo = await fetchProductInfoFromWeb(product.barcode)

      if (!productInfo) {
        toast({
          title: "Product not found",
          description: `No information found for barcode ${product.barcode}`,
          variant: "destructive",
        })
        return
      }

      // Update the product with the fetched info
      const updatedProduct = {
        ...product,
        name: product.name || productInfo.name,
        price: product.price || productInfo.price,
        image: product.image?.includes("placeholder") ? productInfo.image : product.image,
        category_id: product.category_id || null,
      }

      setSelectedProduct(updatedProduct)

      toast({
        title: "Product info fetched",
        description: `Successfully retrieved information for ${productInfo.name}`,
      })
    } catch (error) {
      console.error("Error fetching product info:", error)
      toast({
        title: "Failed to fetch product info",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setFetchingInfo(false)
    }
  }

  async function handleSaveProduct() {
    if (!selectedProduct) return

    setSaving(true)
    try {
      console.log("Saving product:", selectedProduct)
      const savedProduct = await saveProduct(selectedProduct)
      console.log("Product saved successfully:", savedProduct)

      // Update the products list with the saved product
      setProducts((prevProducts) => {
        const updatedProducts = prevProducts.map((p) => (p.id === savedProduct.id ? savedProduct : p))
        console.log("Updated products state")
        return updatedProducts
      })

      // Force UI update with a slight delay
      setTimeout(() => {
        filterProducts()
        updateCurrentBatch()
        console.log("Forced UI update")
      }, 100)

      toast({
        title: "Product saved",
        description: `Successfully saved ${savedProduct.name}`,
      })

      // Clear the selected product
      setSelectedProduct(null)
    } catch (error) {
      console.error("Error saving product:", error)
      toast({
        title: "Failed to save product",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  function handleSelectProduct(product: Product) {
    setSelectedProduct({ ...product })
  }

  function handleInputChange(field: keyof Product, value: any) {
    if (!selectedProduct) return

    setSelectedProduct({
      ...selectedProduct,
      [field]: value,
    })
  }

  function toggleProductSelection(productId: string) {
    const newSelectedIds = new Set(selectedProductIds)

    if (newSelectedIds.has(productId)) {
      newSelectedIds.delete(productId)
    } else {
      newSelectedIds.add(productId)
    }

    setSelectedProductIds(newSelectedIds)
  }

  function selectAllProducts() {
    const allIds = new Set(currentBatch.map((p) => p.id || "").filter((id) => id !== ""))
    setSelectedProductIds(allIds)
  }

  function clearSelection() {
    setSelectedProductIds(new Set())
  }

  async function processBatchProducts() {
    if (selectedProductIds.size === 0) {
      toast({
        title: "No products selected",
        description: "Please select at least one product to process",
        variant: "destructive",
      })
      return
    }

    if (!Object.values(batchUpdateOptions).some(Boolean)) {
      toast({
        title: "No update options selected",
        description: "Please select at least one field to update",
        variant: "destructive",
      })
      return
    }

    setBatchProcessing(true)
    setProcessingProgress(0)
    setProcessingResults([])
    setShowResults(false)

    const selectedProducts = products.filter((p) => p.id && selectedProductIds.has(p.id))
    const results: ProcessingResult[] = []
    let processed = 0
    let updatedProducts = [...products] // Create a copy of the products array

    for (const product of selectedProducts) {
      try {
        if (!product.barcode) {
          results.push({
            product,
            success: false,
            error: "Missing barcode",
          })
          processed++
          setProcessingProgress(Math.round((processed / selectedProducts.length) * 100))
          continue
        }

        // Create a copy of the product to update
        const updatedProduct = { ...product }
        console.log("Original product:", product)

        // Only fetch product info if we need to update fields that come from the web
        if (batchUpdateOptions.updateName || batchUpdateOptions.updateImage || batchUpdateOptions.updatePrice) {
          try {
            // Fetch product info
            const productInfo = await fetchProductInfoFromWeb(product.barcode)
            console.log("Fetched product info:", productInfo)

            if (productInfo) {
              // Update fields based on selected options - ALWAYS update if option is selected
              if (batchUpdateOptions.updateName) {
                updatedProduct.name = productInfo.name
                console.log(`Updating name to: ${productInfo.name}`)
              }

              if (batchUpdateOptions.updatePrice) {
                updatedProduct.price = productInfo.price
              }

              if (batchUpdateOptions.updateImage) {
                updatedProduct.image = productInfo.image
              }
            }
          } catch (error) {
            console.log(`Could not fetch info for ${product.barcode}, continuing with manual updates`)
            // Continue with manual updates even if fetch fails
          }
        }

        // Apply stock updates based on selected options
        if (batchUpdateOptions.updateStock) {
          updatedProduct.stock = defaultStockValue
        }

        if (batchUpdateOptions.updateMinStock) {
          updatedProduct.min_stock = defaultMinStockValue
        }

        // Calculate isLowStock based on the updated stock values
        if (typeof updatedProduct.stock === "number" && typeof updatedProduct.min_stock === "number") {
          updatedProduct.isLowStock = updatedProduct.stock <= updatedProduct.min_stock
        }

        console.log("Product to save:", updatedProduct)

        // Save the updated product
        const savedProduct = await saveProduct(updatedProduct)
        console.log("Saved product:", savedProduct)

        // Update our local copy of the products array
        updatedProducts = updatedProducts.map((p) => (p.id === savedProduct.id ? savedProduct : p))

        results.push({
          product: savedProduct,
          success: true,
        })
      } catch (error) {
        console.error(`Error processing product ${product.id}:`, error)
        results.push({
          product,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        })
      }

      processed++
      setProcessingProgress(Math.round((processed / selectedProducts.length) * 100))
    }

    // Update all state at once after processing is complete
    setProducts(updatedProducts)

    // Force a re-render by explicitly updating filtered products and current batch
    setTimeout(() => {
      filterProducts()
      updateCurrentBatch()
    }, 100)

    setProcessingResults(results)
    setShowResults(true)
    setBatchProcessing(false)

    // Show summary toast
    const successCount = results.filter((r) => r.success).length
    toast({
      title: "Batch processing complete",
      description: `Successfully processed ${successCount} of ${results.length} products`,
      variant: successCount === results.length ? "default" : "destructive",
    })
  }

  // Helper function to check if a product is expiring soon
  function isExpiringSoon(expiryDateStr: string, notificationDays: number): boolean {
    if (!expiryDateStr) return false

    const expiryDate = new Date(expiryDateStr)
    const today = new Date()
    const diffTime = expiryDate.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    return diffDays <= notificationDays && diffDays >= 0
  }

  // Add a debug function to help troubleshoot UI updates
  function debugProductState() {
    console.log("Current products state:", products)
    console.log("Current filtered products:", filteredProducts)
    console.log("Current batch:", currentBatch)

    // Add a button to the UI to trigger this debug function
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          console.log("Current products state:", products)
          console.log("Current filtered products:", filteredProducts)
          console.log("Current batch:", currentBatch)
        }}
        className="ml-2"
      >
        Debug State
      </Button>
    )
  }

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">Incomplete Products Manager</h1>
          <Button variant="outline" size="sm" onClick={() => fetchProducts()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
          </Button>
          {debugProductState()}
        </div>

        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or barcode"
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <Select value={batchSize.toString()} onValueChange={(value) => setBatchSize(Number.parseInt(value))}>
            <SelectTrigger className="w-full md:w-40">
              <SelectValue placeholder="Batch size" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5">5 products</SelectItem>
              <SelectItem value="10">10 products</SelectItem>
              <SelectItem value="20">20 products</SelectItem>
              <SelectItem value="50">50 products</SelectItem>
              <SelectItem value="100">100 products</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="missing-name"
            checked={filters.missingName}
            onCheckedChange={(checked: boolean | "indeterminate") =>
              setFilters({ ...filters, missingName: checked === true })
            }
          />
          <Label htmlFor="missing-name">Missing Name</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="missing-image"
            checked={filters.missingImage}
            onCheckedChange={(checked: boolean | "indeterminate") =>
              setFilters({ ...filters, missingImage: checked === true })
            }
          />
          <Label htmlFor="missing-image">Missing Image</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="missing-stock"
            checked={filters.missingStock}
            onCheckedChange={(checked: boolean | "indeterminate") =>
              setFilters({ ...filters, missingStock: checked === true })
            }
          />
          <Label htmlFor="missing-stock">Missing Stock</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="missing-min-stock"
            checked={filters.missingMinStock}
            onCheckedChange={(checked: boolean | "indeterminate") =>
              setFilters({ ...filters, missingMinStock: checked === true })
            }
          />
          <Label htmlFor="missing-min-stock">Missing Min Stock</Label>
        </div>
      </div>

      {/* Batch processing controls */}
      <div className="mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Batch Processing</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={selectAllProducts}
                  disabled={currentBatch.length === 0 || batchProcessing}
                >
                  Select All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearSelection}
                  disabled={selectedProductIds.size === 0 || batchProcessing}
                >
                  Clear Selection
                </Button>
                <span className="text-sm text-muted-foreground">{selectedProductIds.size} products selected</span>
              </div>

              <div className="space-y-4 border rounded-md p-3">
                <h3 className="font-medium">Update Options</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="update-name"
                        checked={batchUpdateOptions.updateName}
                        onCheckedChange={(checked) =>
                          setBatchUpdateOptions({ ...batchUpdateOptions, updateName: checked === true })
                        }
                        disabled={batchProcessing}
                      />
                      <Label htmlFor="update-name">Update Names</Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="update-image"
                        checked={batchUpdateOptions.updateImage}
                        onCheckedChange={(checked) =>
                          setBatchUpdateOptions({ ...batchUpdateOptions, updateImage: checked === true })
                        }
                        disabled={batchProcessing}
                      />
                      <Label htmlFor="update-image">Update Images</Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="update-price"
                        checked={batchUpdateOptions.updatePrice}
                        onCheckedChange={(checked) =>
                          setBatchUpdateOptions({ ...batchUpdateOptions, updatePrice: checked === true })
                        }
                        disabled={batchProcessing}
                      />
                      <Label htmlFor="update-price">Update Prices</Label>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="update-stock"
                        checked={batchUpdateOptions.updateStock}
                        onCheckedChange={(checked) =>
                          setBatchUpdateOptions({ ...batchUpdateOptions, updateStock: checked === true })
                        }
                        disabled={batchProcessing}
                      />
                      <Label htmlFor="update-stock">Set Default Stock</Label>
                    </div>

                    {batchUpdateOptions.updateStock && (
                      <div className="pl-6">
                        <Input
                          type="number"
                          placeholder="Default stock value"
                          value={defaultStockValue.toString()}
                          onChange={(e) => setDefaultStockValue(Number(e.target.value) || 0)}
                          disabled={batchProcessing}
                          className="w-full"
                        />
                      </div>
                    )}

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="update-min-stock"
                        checked={batchUpdateOptions.updateMinStock}
                        onCheckedChange={(checked) =>
                          setBatchUpdateOptions({ ...batchUpdateOptions, updateMinStock: checked === true })
                        }
                        disabled={batchProcessing}
                      />
                      <Label htmlFor="update-min-stock">Set Default Min Stock</Label>
                    </div>

                    {batchUpdateOptions.updateMinStock && (
                      <div className="pl-6">
                        <Input
                          type="number"
                          placeholder="Default min stock value"
                          value={defaultMinStockValue.toString()}
                          onChange={(e) => setDefaultMinStockValue(Number(e.target.value) || 0)}
                          disabled={batchProcessing}
                          className="w-full"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {batchProcessing ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Processing...</span>
                    <span className="text-sm text-muted-foreground">{processingProgress}%</span>
                  </div>
                  <Progress value={processingProgress} className="h-2" />
                </div>
              ) : (
                <Button
                  onClick={processBatchProducts}
                  disabled={selectedProductIds.size === 0 || !Object.values(batchUpdateOptions).some(Boolean)}
                  className="w-full md:w-auto"
                >
                  <BarcodeScan className="mr-2 h-4 w-4" />
                  Process Selected Products
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Processing results */}
      {showResults && processingResults.length > 0 && (
        <div className="mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between">
                <span>Processing Results</span>
                <Button variant="ghost" size="sm" onClick={() => setShowResults(false)}>
                  Hide
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    Successfully processed: {processingResults.filter((r) => r.success).length} of{" "}
                    {processingResults.length}
                  </span>
                </div>

                <div className="max-h-60 overflow-y-auto space-y-2">
                  {processingResults
                    .filter((r) => !r.success)
                    .map((result, index) => (
                      <Alert key={index} variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Failed: {result.product.name || result.product.barcode}</AlertTitle>
                        <AlertDescription>{result.error}</AlertDescription>
                      </Alert>
                    ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          Showing {currentBatch.length} of {filteredProducts.length} products
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <div className="col-span-full flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : currentBatch.length === 0 ? (
          <div className="col-span-full py-12 text-center">
            <p className="text-muted-foreground">No products match your filters</p>
          </div>
        ) : (
          currentBatch.map((product) => (
            <Card
              key={`${product.id}-${Date.now()}`}
              className={selectedProduct?.id === product.id ? "border-primary" : ""}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={product.id ? selectedProductIds.has(product.id) : false}
                      onCheckedChange={() => product.id && toggleProductSelection(product.id)}
                      disabled={batchProcessing}
                    />
                    <CardTitle className="text-base">
                      <span className="truncate">
                        {product.name || <span className="text-muted-foreground italic">No name</span>}
                      </span>
                    </CardTitle>
                  </div>
                  <span className="text-xs font-normal text-muted-foreground">{product.barcode}</span>
                </div>
              </CardHeader>
              <CardContent className="pb-2">
                <div className="flex h-24 items-center justify-center overflow-hidden rounded-md bg-muted">
                  {product.image && !product.image.includes("placeholder") ? (
                    <img
                      src={product.image || "/placeholder.svg"}
                      alt={product.name || "Product"}
                      className="h-full w-auto object-contain"
                    />
                  ) : (
                    <Package className="h-12 w-12 text-muted-foreground" />
                  )}
                </div>

                <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Stock:</span>{" "}
                    {product.stock !== undefined && product.stock !== null ? (
                      product.stock
                    ) : (
                      <span className="text-destructive">Missing</span>
                    )}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Min Stock:</span>{" "}
                    {product.min_stock !== undefined && product.min_stock !== null ? (
                      product.min_stock
                    ) : (
                      <span className="text-destructive">Missing</span>
                    )}
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => handleSelectProduct(product)}
                  disabled={batchProcessing}
                >
                  Edit
                </Button>
              </CardFooter>
            </Card>
          ))
        )}
      </div>

      {filteredProducts.length > currentBatch.length && (
        <div className="mt-4 flex justify-center">
          <Button
            variant="outline"
            onClick={() =>
              setCurrentBatch((prevBatch) => [
                ...prevBatch,
                ...filteredProducts.slice(prevBatch.length, prevBatch.length + batchSize),
              ])
            }
          >
            Load More
          </Button>
        </div>
      )}

      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-h-[90vh] overflow-auto max-w-2xl">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Edit Product</span>
                <Button variant="ghost" size="sm" onClick={() => setSelectedProduct(null)}>
                  Close
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="basic">
                <TabsList className="mb-4 w-full">
                  <TabsTrigger value="basic" className="flex-1">
                    Basic Info
                  </TabsTrigger>
                  <TabsTrigger value="stock" className="flex-1">
                    Stock
                  </TabsTrigger>
                  <TabsTrigger value="image" className="flex-1">
                    Image
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="basic">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-medium">Product Information</h3>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleFetchInfo(selectedProduct)}
                        disabled={fetchingInfo}
                      >
                        {fetchingInfo ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <BarcodeScan className="mr-2 h-4 w-4" />
                        )}
                        Fetch Info
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="barcode">Barcode</Label>
                      <Input
                        id="barcode"
                        value={selectedProduct.barcode || ""}
                        onChange={(e) => handleInputChange("barcode", e.target.value)}
                        readOnly
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="name">Name</Label>
                      <Input
                        id="name"
                        value={selectedProduct.name || ""}
                        onChange={(e) => handleInputChange("name", e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="price">Price</Label>
                      <Input
                        id="price"
                        type="text"
                        value={selectedProduct.price || ""}
                        onChange={(e) => handleInputChange("price", e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="quantity">Quantity</Label>
                      <Input
                        id="quantity"
                        value={selectedProduct.quantity?.toString() || ""}
                        onChange={(e) => handleInputChange("quantity", e.target.value)}
                        placeholder="e.g., 500g, 1L, 5 pcs"
                      />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="stock">
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Stock Management</h3>

                    <div className="space-y-2">
                      <Label htmlFor="stock">Current Stock</Label>
                      <Input
                        id="stock"
                        type="number"
                        value={selectedProduct.stock?.toString() || ""}
                        onChange={(e) => handleInputChange("stock", Number(e.target.value) || 0)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="min_stock">Minimum Stock</Label>
                      <Input
                        id="min_stock"
                        type="number"
                        value={selectedProduct.min_stock?.toString() || ""}
                        onChange={(e) => handleInputChange("min_stock", Number(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="image">
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Product Image</h3>

                    <div className="flex h-48 items-center justify-center overflow-hidden rounded-md bg-muted">
                      {selectedProduct.image && !selectedProduct.image.includes("placeholder") ? (
                        <img
                          src={selectedProduct.image || "/placeholder.svg"}
                          alt={selectedProduct.name || "Product"}
                          className="h-full w-auto object-contain"
                        />
                      ) : (
                        <ImageIcon className="h-16 w-16 text-muted-foreground" />
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="image">Image URL</Label>
                      <Input
                        id="image"
                        value={selectedProduct.image || ""}
                        onChange={(e) => handleInputChange("image", e.target.value)}
                        placeholder="https://example.com/image.jpg"
                      />
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline" onClick={() => setSelectedProduct(null)}>
                Cancel
              </Button>
              <Button onClick={handleSaveProduct} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Product
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  )
}

