"use client"

import { useState, useEffect, useMemo } from "react"
import { fetchProductInfoFromWeb, saveProduct } from "@/services/product-service"
import type { Product } from "@/types/product"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import {
  Loader2,
  Search,
  Save,
  Package,
  ScanBarcodeIcon as BarcodeScan,
  AlertCircle,
  Grid3X3,
  List,
  Filter,
  X,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  ImageOff,
  Tag,
  Layers,
  ShoppingCart,
  Settings,
  Sliders,
  ArrowDownUp,
  Info,
} from "lucide-react"
import { supabase, isSupabaseInitialized } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"

interface ProcessingResult {
  product: Product
  success: boolean
  error?: string
}

type ViewMode = "grid" | "list" | "table"

export function IncompleteProductsManager() {
  const [products, setProducts] = useState<Product[]>([])
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [batchSize, setBatchSize] = useState(20)
  const [currentBatch, setCurrentBatch] = useState<Product[]>([])
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [fetchingInfo, setFetchingInfo] = useState(false)
  const [batchProcessing, setBatchProcessing] = useState(false)
  const [processingProgress, setProcessingProgress] = useState(0)
  const [processingResults, setProcessingResults] = useState<ProcessingResult[]>([])
  const [showResults, setShowResults] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>("grid")
  const [sortField, setSortField] = useState<keyof Product>("created_at")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")
  const [filtersOpen, setFiltersOpen] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [filters, setFilters] = useState({
    missingName: false,
    missingImage: false,
    missingStock: false,
    missingMinStock: false,
    lowStock: false,
    hasBarcode: false,
  })
  const { toast } = useToast()
  const [categories, setCategories] = useState<any[]>([])

  const [batchUpdateOptions, setBatchUpdateOptions] = useState({
    updateName: true,
    updateImage: true,
    updatePrice: true,
    updateStock: true,
    updateMinStock: true,
  })
  const [defaultStockValue, setDefaultStockValue] = useState(11)
  const [defaultMinStockValue, setDefaultMinStockValue] = useState(10)

  // Fetch all products on component mount
  useEffect(() => {
    fetchProducts()
  }, [])

  // Fetch categories on component mount
  useEffect(() => {
    fetchCategories()
  }, [])

  // Filter products when search query or filters change
  useEffect(() => {
    filterProducts()
  }, [products, searchQuery, filters, sortField, sortDirection])

  // Update current batch when filtered products or batch size changes
  useEffect(() => {
    updateCurrentBatch()
  }, [filteredProducts, batchSize])

  // Stats for the dashboard
  const stats = useMemo(() => {
    if (!products.length)
      return {
        total: 0,
        missingName: 0,
        missingImage: 0,
        missingStock: 0,
        lowStock: 0,
      }

    return {
      total: products.length,
      missingName: products.filter((p) => !p.name || p.name.trim() === "").length,
      missingImage: products.filter((p) => !p.image || p.image.includes("placeholder")).length,
      missingStock: products.filter((p) => p.stock === undefined || p.stock === null).length,
      lowStock: products.filter((p) => p.isLowStock).length,
    }
  }, [products])

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
          ? checkIfExpiringSoon(item.expiry_date, item.expiry_notification_days || 30)
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

  async function fetchCategories() {
    try {
      if (!isSupabaseInitialized()) {
        setCategories([])
        return
      }

      const { data, error } = await supabase.from("categories").select("*").order("name", { ascending: true })

      if (error) {
        throw error
      }

      setCategories(data || [])
    } catch (error) {
      console.error("Error fetching categories:", error)
      toast({
        title: "Failed to fetch categories",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
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
          false ||
          (typeof product.category !== "string" && product.category?.name?.toLowerCase().includes(query)) ||
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

    if (filters.lowStock) {
      filtered = filtered.filter((product) => product.isLowStock)
    }

    if (filters.hasBarcode) {
      filtered = filtered.filter((product) => !!product.barcode)
    }

    // Apply sorting
    filtered.sort((a, b) => {
      const aValue = a[sortField]
      const bValue = b[sortField]

      // Handle undefined or null values
      if (aValue === undefined || aValue === null) return sortDirection === "asc" ? -1 : 1
      if (bValue === undefined || bValue === null) return sortDirection === "asc" ? 1 : -1

      // Compare based on type
      if (typeof aValue === "string" && typeof bValue === "string") {
        return sortDirection === "asc" ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue)
      }

      // For numbers, dates, etc.
      return sortDirection === "asc"
        ? aValue < bValue
          ? -1
          : aValue > bValue
            ? 1
            : 0
        : bValue < aValue
          ? -1
          : bValue > aValue
            ? 1
            : 0
    })

    setFilteredProducts(filtered)
  }

  function updateCurrentBatch() {
    setCurrentBatch(filteredProducts.slice(0, batchSize))
  }

  function handleSort(field: keyof Product) {
    if (field === sortField) {
      // Toggle direction if same field
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      // New field, default to descending
      setSortField(field)
      setSortDirection("desc")
    }
  }

  function getSortIcon(field: keyof Product) {
    if (field !== sortField) return null
    return sortDirection === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
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
    let attempts = 0
    const maxAttempts = 3

    while (attempts < maxAttempts) {
      try {
        attempts++
        console.log(`Attempt ${attempts} to fetch product info for ${product.barcode}`)

        const productInfo = await fetchProductInfoFromWeb(product.barcode)

        if (!productInfo) {
          if (attempts < maxAttempts) {
            console.log(`No information found, retrying (${attempts}/${maxAttempts})...`)
            continue
          }

          toast({
            title: "Product not found",
            description: `No information found for barcode ${product.barcode}`,
            variant: "destructive",
          })
          setFetchingInfo(false)
          return
        }

        // Update the product with the fetched info
        const updatedProduct: Product = {
          ...product,
          name: product.name || productInfo.name || "", // Ensure name is never undefined
          price: product.price || productInfo.price || undefined,
          image: product.image?.includes("placeholder") ? productInfo.image || "" : product.image || "",
          quantity: product.quantity || productInfo.quantity || undefined,
          category_id: product.category_id || null,
        }

        setSelectedProduct(updatedProduct)

        toast({
          title: "Product info fetched",
          description: `Successfully retrieved information for ${productInfo.name || product.barcode}`,
        })

        setFetchingInfo(false)
        return
      } catch (error) {
        console.error(`Attempt ${attempts} failed:`, error)

        if (attempts >= maxAttempts) {
          console.error("All attempts failed to fetch product info:", error)
          toast({
            title: "Failed to fetch product info",
            description:
              error instanceof Error
                ? `Error: ${error.message}. Please try again later.`
                : "Network error or timeout. Please check your connection and try again.",
            variant: "destructive",
          })
        } else {
          // Wait a bit before retrying
          await new Promise((resolve) => setTimeout(resolve, 1000))
        }
      }
    }

    setFetchingInfo(false)
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
          let fetchAttempts = 0
          const maxFetchAttempts = 3
          let productInfo = null

          while (fetchAttempts < maxFetchAttempts && !productInfo) {
            try {
              fetchAttempts++
              console.log(`Attempt ${fetchAttempts} to fetch info for ${product.barcode}`)

              // Fetch product info
              productInfo = await fetchProductInfoFromWeb(product.barcode)
              console.log("Fetched product info:", productInfo)

              if (productInfo) {
                // Update fields based on selected options - ALWAYS update if option is selected
                if (batchUpdateOptions.updateName) {
                  updatedProduct.name = productInfo.name || "" // Ensure name is never undefined
                  console.log(`Updating name to: ${productInfo.name}`)
                }

                if (batchUpdateOptions.updatePrice && productInfo.price) {
                  updatedProduct.price = productInfo.price
                }

                if (batchUpdateOptions.updateImage && productInfo.image && !productInfo.image.includes("placeholder")) {
                  updatedProduct.image = productInfo.image
                  console.log(`Updating image to: ${productInfo.image}`)
                }

                if (productInfo.quantity && !updatedProduct.quantity) {
                  updatedProduct.quantity = productInfo.quantity
                }
              }
            } catch (error) {
              console.log(`Fetch attempt ${fetchAttempts} failed for ${product.barcode}:`, error)

              if (fetchAttempts < maxFetchAttempts) {
                // Wait a bit before retrying
                await new Promise((resolve) => setTimeout(resolve, 1000))
              } else {
                console.log(
                  `Could not fetch info for ${product.barcode} after ${maxFetchAttempts} attempts, continuing with manual updates`,
                )
              }
            }
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
  function checkIfExpiringSoon(expiryDateStr: string, notificationDays: number): boolean {
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

  function renderProductGrid() {
    if (loading) {
      return (
        <div className="col-span-full flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )
    }

    if (currentBatch.length === 0) {
      return (
        <div className="col-span-full py-12 text-center">
          <p className="text-muted-foreground">No products match your filters</p>
        </div>
      )
    }

    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {currentBatch.map((product) => (
          <Card
            key={`${product.id}-${Date.now()}`}
            className={`overflow-hidden transition-all hover:shadow-md ${
              selectedProduct?.id === product.id ? "border-primary ring-1 ring-primary" : ""
            }`}
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
                  <ImageOff className="h-12 w-12 text-muted-foreground" />
                )}
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Stock:</span>{" "}
                  {product.stock !== undefined && product.stock !== null ? (
                    <span className={product.isLowStock ? "text-destructive font-medium" : ""}>{product.stock}</span>
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
                <div className="col-span-2">
                  <span className="text-muted-foreground">Price:</span>{" "}
                  {product.price ? `$${product.price}` : <span className="text-muted-foreground italic">Not set</span>}
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
        ))}
      </div>
    )
  }

  function renderProductList() {
    if (loading) {
      return (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )
    }

    if (currentBatch.length === 0) {
      return (
        <div className="py-12 text-center">
          <p className="text-muted-foreground">No products match your filters</p>
        </div>
      )
    }

    return (
      <div className="space-y-3">
        {currentBatch.map((product) => (
          <div
            key={`${product.id}-${Date.now()}`}
            className={`flex items-center border rounded-lg p-3 transition-all hover:shadow-md ${
              selectedProduct?.id === product.id ? "border-primary ring-1 ring-primary" : "border-border"
            }`}
          >
            <Checkbox
              checked={product.id ? selectedProductIds.has(product.id) : false}
              onCheckedChange={() => product.id && toggleProductSelection(product.id)}
              disabled={batchProcessing}
              className="mr-3"
            />

            <div className="flex-shrink-0 h-16 w-16 mr-4 flex items-center justify-center bg-muted rounded">
              {product.image && !product.image.includes("placeholder") ? (
                <img
                  src={product.image || "/placeholder.svg"}
                  alt={product.name || "Product"}
                  className="h-full w-auto object-contain"
                />
              ) : (
                <ImageOff className="h-8 w-8 text-muted-foreground" />
              )}
            </div>

            <div className="flex-grow min-w-0">
              <div className="flex items-center justify-between">
                <h3 className="font-medium truncate">
                  {product.name || <span className="text-muted-foreground italic">No name</span>}
                </h3>
                <span className="text-xs text-muted-foreground ml-2">{product.barcode}</span>
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm">
                <div>
                  <span className="text-muted-foreground">Stock:</span>{" "}
                  {product.stock !== undefined && product.stock !== null ? (
                    <span className={product.isLowStock ? "text-destructive font-medium" : ""}>{product.stock}</span>
                  ) : (
                    <span className="text-destructive">Missing</span>
                  )}
                </div>
                <div>
                  <span className="text-muted-foreground">Min:</span>{" "}
                  {product.min_stock !== undefined && product.min_stock !== null ? (
                    product.min_stock
                  ) : (
                    <span className="text-destructive">Missing</span>
                  )}
                </div>
                <div>
                  <span className="text-muted-foreground">Price:</span>{" "}
                  {product.price ? `$${product.price}` : <span className="text-muted-foreground italic">Not set</span>}
                </div>
                {product.category && typeof product.category !== "string" && product.category.name && (
                  <div>
                    <span className="text-muted-foreground">Category:</span> {product.category.name}
                  </div>
                )}
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="ml-2"
              onClick={() => handleSelectProduct(product)}
              disabled={batchProcessing}
            >
              Edit
            </Button>
          </div>
        ))}
      </div>
    )
  }

  function renderProductTable() {
    if (loading) {
      return (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )
    }

    if (currentBatch.length === 0) {
      return (
        <div className="py-12 text-center">
          <p className="text-muted-foreground">No products match your filters</p>
        </div>
      )
    }

    return (
      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">
                <Checkbox
                  checked={currentBatch.length > 0 && currentBatch.every((p) => p.id && selectedProductIds.has(p.id))}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      selectAllProducts()
                    } else {
                      clearSelection()
                    }
                  }}
                  disabled={batchProcessing}
                />
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => handleSort("name")}>
                <div className="flex items-center">Name {getSortIcon("name")}</div>
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => handleSort("barcode")}>
                <div className="flex items-center">Barcode {getSortIcon("barcode")}</div>
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => handleSort("stock")}>
                <div className="flex items-center">Stock {getSortIcon("stock")}</div>
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => handleSort("price")}>
                <div className="flex items-center">Price {getSortIcon("price")}</div>
              </TableHead>
              <TableHead>Image</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentBatch.map((product) => (
              <TableRow
                key={`${product.id}-${Date.now()}`}
                className={selectedProduct?.id === product.id ? "bg-primary/5" : ""}
              >
                <TableCell>
                  <Checkbox
                    checked={product.id ? selectedProductIds.has(product.id) : false}
                    onCheckedChange={() => product.id && toggleProductSelection(product.id)}
                    disabled={batchProcessing}
                  />
                </TableCell>
                <TableCell>{product.name || <span className="text-muted-foreground italic">No name</span>}</TableCell>
                <TableCell>{product.barcode}</TableCell>
                <TableCell>
                  {product.stock !== undefined && product.stock !== null ? (
                    <span className={product.isLowStock ? "text-destructive font-medium" : ""}>{product.stock}</span>
                  ) : (
                    <span className="text-destructive">Missing</span>
                  )}
                </TableCell>
                <TableCell>
                  {product.price ? `$${product.price}` : <span className="text-muted-foreground italic">Not set</span>}
                </TableCell>
                <TableCell>
                  {product.image && !product.image.includes("placeholder") ? (
                    <div className="h-10 w-10 relative">
                      <img
                        src={product.image || "/placeholder.svg"}
                        alt={product.name || "Product"}
                        className="h-full w-full object-contain rounded"
                      />
                    </div>
                  ) : (
                    <div className="h-10 w-10 flex items-center justify-center bg-muted rounded">
                      <ImageOff className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSelectProduct(product)}
                    disabled={batchProcessing}
                  >
                    Edit
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">Product Manager</h1>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" onClick={() => fetchProducts()} disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Refresh Products</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {debugProductState()}
          </div>

          <div className="flex items-center gap-2">
            <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Settings className="h-4 w-4" />
                  <span className="hidden sm:inline">Settings</span>
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Product Manager Settings</SheetTitle>
                  <SheetDescription>Configure default values and behavior for the product manager.</SheetDescription>
                </SheetHeader>
                <div className="py-6 space-y-6">
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Default Stock Values</h3>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="default-stock">Default Stock Value</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            id="default-stock"
                            type="number"
                            value={defaultStockValue}
                            onChange={(e) => setDefaultStockValue(Number(e.target.value))}
                            className="w-full"
                          />
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <Info className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>This value will be used when setting stock in batch operations</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="default-min-stock">Default Minimum Stock Value</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            id="default-min-stock"
                            type="number"
                            value={defaultMinStockValue}
                            onChange={(e) => setDefaultMinStockValue(Number(e.target.value))}
                            className="w-full"
                          />
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <Info className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Products with stock below this value will be marked as low stock</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Display Settings</h3>
                    <div className="space-y-2">
                      <Label htmlFor="batch-size">Default Batch Size</Label>
                      <Select
                        value={batchSize.toString()}
                        onValueChange={(value) => setBatchSize(Number.parseInt(value))}
                      >
                        <SelectTrigger id="batch-size" className="w-full">
                          <SelectValue placeholder="Batch size" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10 products</SelectItem>
                          <SelectItem value="20">20 products</SelectItem>
                          <SelectItem value="50">50 products</SelectItem>
                          <SelectItem value="100">100 products</SelectItem>
                          <SelectItem value="200">200 products</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Default View Mode</Label>
                      <div className="flex border rounded-md">
                        <Button
                          variant={viewMode === "grid" ? "default" : "ghost"}
                          size="sm"
                          onClick={() => setViewMode("grid")}
                          className="flex-1 rounded-r-none"
                        >
                          <Grid3X3 className="h-4 w-4 mr-2" />
                          Grid
                        </Button>
                        <Button
                          variant={viewMode === "list" ? "default" : "ghost"}
                          size="sm"
                          onClick={() => setViewMode("list")}
                          className="flex-1 rounded-none border-x"
                        >
                          <List className="h-4 w-4 mr-2" />
                          List
                        </Button>
                        <Button
                          variant={viewMode === "table" ? "default" : "ghost"}
                          size="sm"
                          onClick={() => setViewMode("table")}
                          className="flex-1 rounded-l-none"
                        >
                          <Layers className="h-4 w-4 mr-2" />
                          Table
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {/* Dashboard Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Products</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Layers className="h-8 w-8 text-primary" />
            </CardContent>
          </Card>

          <Card
            className={
              stats.missingName > 0 ? "bg-gradient-to-br from-amber-500/5 to-amber-500/10 border-amber-500/20" : ""
            }
          >
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Missing Names</p>
                <p className="text-2xl font-bold">{stats.missingName}</p>
              </div>
              <Tag className={`h-8 w-8 ${stats.missingName > 0 ? "text-amber-500" : "text-muted-foreground"}`} />
            </CardContent>
          </Card>

          <Card
            className={
              stats.missingImage > 0 ? "bg-gradient-to-br from-amber-500/5 to-amber-500/10 border-amber-500/20" : ""
            }
          >
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Missing Images</p>
                <p className="text-2xl font-bold">{stats.missingImage}</p>
              </div>
              <ImageOff className={`h-8 w-8 ${stats.missingImage > 0 ? "text-amber-500" : "text-muted-foreground"}`} />
            </CardContent>
          </Card>

          <Card
            className={
              stats.missingStock > 0 ? "bg-gradient-to-br from-amber-500/5 to-amber-500/10 border-amber-500/20" : ""
            }
          >
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Missing Stock</p>
                <p className="text-2xl font-bold">{stats.missingStock}</p>
              </div>
              <Package className={`h-8 w-8 ${stats.missingStock > 0 ? "text-amber-500" : "text-muted-foreground"}`} />
            </CardContent>
          </Card>

          <Card
            className={stats.lowStock > 0 ? "bg-gradient-to-br from-red-500/5 to-red-500/10 border-red-500/20" : ""}
          >
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Low Stock</p>
                <p className="text-2xl font-bold">{stats.lowStock}</p>
              </div>
              <ShoppingCart className={`h-8 w-8 ${stats.lowStock > 0 ? "text-red-500" : "text-muted-foreground"}`} />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Search and View Controls */}
      <div className="flex flex-wrap gap-4 items-center justify-between bg-card p-4 rounded-lg border shadow-sm">
        <div className="relative w-full md:w-64">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or barcode"
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <ArrowDownUp className="h-4 w-4" />
                <span>Sort</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Sort by</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleSort("name")}>
                Name {sortField === "name" && (sortDirection === "asc" ? "(A-Z)" : "(Z-A)")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSort("created_at")}>
                Date Added {sortField === "created_at" && (sortDirection === "asc" ? "(Oldest)" : "(Newest)")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSort("stock")}>
                Stock {sortField === "stock" && (sortDirection === "asc" ? "(Low-High)" : "(High-Low)")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSort("price")}>
                Price {sortField === "price" && (sortDirection === "asc" ? "(Low-High)" : "(High-Low)")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Filter className="h-4 w-4" />
                <span>Filter</span>
                {Object.values(filters).some(Boolean) && (
                  <Badge variant="secondary" className="ml-1 px-1 rounded-sm">
                    {Object.values(filters).filter(Boolean).length}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Filter Products</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="p-2 space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="dropdown-missing-name"
                    checked={filters.missingName}
                    onCheckedChange={(checked) => setFilters({ ...filters, missingName: checked === true })}
                  />
                  <Label htmlFor="dropdown-missing-name" className="flex items-center gap-2">
                    Missing Name
                    <Badge variant="outline">{stats.missingName}</Badge>
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="dropdown-missing-image"
                    checked={filters.missingImage}
                    onCheckedChange={(checked) => setFilters({ ...filters, missingImage: checked === true })}
                  />
                  <Label htmlFor="dropdown-missing-image" className="flex items-center gap-2">
                    Missing Image
                    <Badge variant="outline">{stats.missingImage}</Badge>
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="dropdown-missing-stock"
                    checked={filters.missingStock}
                    onCheckedChange={(checked) => setFilters({ ...filters, missingStock: checked === true })}
                  />
                  <Label htmlFor="dropdown-missing-stock" className="flex items-center gap-2">
                    Missing Stock
                    <Badge variant="outline">{stats.missingStock}</Badge>
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="dropdown-missing-min-stock"
                    checked={filters.missingMinStock}
                    onCheckedChange={(checked) => setFilters({ ...filters, missingMinStock: checked === true })}
                  />
                  <Label htmlFor="dropdown-missing-min-stock">Missing Min Stock</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="dropdown-low-stock"
                    checked={filters.lowStock}
                    onCheckedChange={(checked) => setFilters({ ...filters, lowStock: checked === true })}
                  />
                  <Label htmlFor="dropdown-low-stock" className="flex items-center gap-2">
                    Low Stock
                    <Badge variant="outline">{stats.lowStock}</Badge>
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="dropdown-has-barcode"
                    checked={filters.hasBarcode}
                    onCheckedChange={(checked) => setFilters({ ...filters, hasBarcode: checked === true })}
                  />
                  <Label htmlFor="dropdown-has-barcode">Has Barcode</Label>
                </div>
              </div>
              <DropdownMenuSeparator />
              <div className="p-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() =>
                    setFilters({
                      missingName: false,
                      missingImage: false,
                      missingStock: false,
                      missingMinStock: false,
                      lowStock: false,
                      hasBarcode: false,
                    })
                  }
                  disabled={!Object.values(filters).some(Boolean)}
                >
                  <X className="h-4 w-4 mr-2" />
                  Clear Filters
                </Button>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex border rounded-md">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={viewMode === "grid" ? "default" : "ghost"}
                    size="icon"
                    onClick={() => setViewMode("grid")}
                    className="rounded-r-none"
                  >
                    <Grid3X3 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Grid View</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={viewMode === "list" ? "default" : "ghost"}
                    size="icon"
                    onClick={() => setViewMode("list")}
                    className="rounded-none border-x"
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>List View</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={viewMode === "table" ? "default" : "ghost"}
                    size="icon"
                    onClick={() => setViewMode("table")}
                    className="rounded-l-none"
                  >
                    <Layers className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Table View</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </div>

      {/* Batch Processing Controls */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sliders className="h-4 w-4" />
              <span>Batch Processing</span>
            </div>
            <Badge variant="secondary" className="ml-auto">
              {selectedProductIds.size} selected
            </Badge>
          </CardTitle>
          <CardDescription>Select products and apply changes in bulk</CardDescription>
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
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-4 border rounded-md p-3">
                <h3 className="font-medium flex items-center gap-2">
                  <Tag className="h-4 w-4" />
                  Update Options
                </h3>

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
              </div>

              <div className="space-y-4 border rounded-md p-3">
                <h3 className="font-medium flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Stock Settings
                </h3>

                <div className="space-y-2">
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
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          placeholder="Default stock value"
                          value={defaultStockValue.toString()}
                          onChange={(e) => setDefaultStockValue(Number(e.target.value) || 0)}
                          disabled={batchProcessing}
                          className="w-full"
                        />
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <Info className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Current value: {defaultStockValue}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
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
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          placeholder="Default min stock value"
                          value={defaultMinStockValue.toString()}
                          onChange={(e) => setDefaultMinStockValue(Number(e.target.value) || 0)}
                          disabled={batchProcessing}
                          className="w-full"
                        />
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <Info className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Current value: {defaultMinStockValue}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
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
                className="w-full"
              >
                <BarcodeScan className="mr-2 h-4 w-4" />
                Process Selected Products
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Processing results */}
      {showResults && processingResults.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span>Processing Results</span>
                <Badge variant={processingResults.every((r) => r.success) ? "default" : "destructive"}>
                  {processingResults.filter((r) => r.success).length}/{processingResults.length} Successful
                </Badge>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowResults(false)}>
                Hide
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
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
      )}

      {/* Product List */}
      <div className="bg-card p-4 rounded-lg border shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            Showing {currentBatch.length} of {filteredProducts.length} products
          </h2>
        </div>

        {viewMode === "grid" && renderProductGrid()}
        {viewMode === "list" && renderProductList()}
        {viewMode === "table" && renderProductTable()}

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
              Load More ({Math.min(batchSize, filteredProducts.length - currentBatch.length)} more)
            </Button>
          </div>
        )}
      </div>

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

                    <div className="space-y-2">
                      <Label htmlFor="category">Category</Label>
                      <Select
                        value={selectedProduct.category_id?.toString() || ""}
                        onValueChange={(value) => handleInputChange("category_id", value)}
                      >
                        <SelectTrigger id="category">
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {categories.map((category) => (
                            <SelectItem key={category.id} value={category.id.toString()}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                        <ImageOff className="h-16 w-16 text-muted-foreground" />
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

