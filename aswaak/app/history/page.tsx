"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Search,
  ArrowUpDown,
  Calendar,
  BarChart4,
  Package,
  RefreshCw,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { ProductForm } from "@/components/product-form"
import { ProductDisplay } from "@/components/product-display"
import { fetchCategories } from "@/services/category-service"
import { saveProduct } from "@/services/product-service"
import type { Product, Category } from "@/types/product"

export default function HistoryPage() {
  const [history, setHistory] = useState<Product[]>([])
  const [filteredHistory, setFilteredHistory] = useState<Product[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState("")
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [sortField, setSortField] = useState<string>("created_at")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [showProductDetails, setShowProductDetails] = useState(false)
  const { toast } = useToast()
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  // Load history from localStorage
  useEffect(() => {
    const loadHistory = () => {
      const storedHistory = localStorage.getItem("scanHistory")
      if (storedHistory) {
        try {
          const parsedHistory = JSON.parse(storedHistory)
          setHistory(parsedHistory)
          setFilteredHistory(parsedHistory)
        } catch (error) {
          console.error("Error parsing scan history:", error)
          toast({
            title: "Error",
            description: "Failed to load scan history",
            variant: "destructive",
          })
        }
      }
    }

    loadHistory()
    loadCategories()
  }, [toast, refreshTrigger])

  // Load categories
  const loadCategories = async () => {
    try {
      const categoryList = await fetchCategories()
      setCategories(categoryList)
    } catch (error) {
      console.error("Failed to load categories:", error)
    }
  }

  // Filter and sort history when search query or sort parameters change
  useEffect(() => {
    let filtered = [...history]

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (product) => product.name.toLowerCase().includes(query) || (product.barcode && product.barcode.includes(query)),
      )
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let valueA: any
      let valueB: any

      // Handle different field types
      switch (sortField) {
        case "name":
          valueA = a.name.toLowerCase()
          valueB = b.name.toLowerCase()
          break
        case "price":
          valueA = Number.parseFloat(a.price)
          valueB = Number.parseFloat(b.price)
          break
        case "stock":
          valueA = a.stock
          valueB = b.stock
          break
        case "created_at":
        default:
          valueA = a.created_at ? new Date(a.created_at).getTime() : 0
          valueB = b.created_at ? new Date(b.created_at).getTime() : 0
          break
      }

      // Apply sort direction
      if (sortDirection === "asc") {
        return valueA > valueB ? 1 : -1
      } else {
        return valueA < valueB ? 1 : -1
      }
    })

    setFilteredHistory(filtered)
    setCurrentPage(1)
  }, [searchQuery, history, sortField, sortDirection])

  // Calculate pagination
  const totalPages = Math.ceil(filteredHistory.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentItems = filteredHistory.slice(startIndex, endIndex)

  // Handle page change
  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages) return
    setCurrentPage(page)
  }

  // Handle sort change
  const handleSort = (field: string) => {
    if (field === sortField) {
      // Toggle direction if same field
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      // Set new field and default to ascending
      setSortField(field)
      setSortDirection("asc")
    }
  }

  // Format date for display
  const formatDate = (dateString?: string) => {
    if (!dateString) return "Unknown date"

    try {
      const date = new Date(dateString)
      return date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    } catch (e) {
      return "Invalid date"
    }
  }

  // Handle product edit
  const handleEditProduct = (product: Product) => {
    setSelectedProduct(product)
    setShowForm(true)
  }

  // Handle product view
  const handleViewProduct = (product: Product) => {
    setSelectedProduct(product)
    setShowProductDetails(true)
  }

  // Handle product delete
  const handleDeleteProduct = (product: Product) => {
    try {
      // Remove from history array
      const updatedHistory = history.filter((p) => p.barcode !== product.barcode || p.id !== product.id)

      // Update state
      setHistory(updatedHistory)

      // Update localStorage
      localStorage.setItem("scanHistory", JSON.stringify(updatedHistory))

      toast({
        title: "Product removed",
        description: "Product has been removed from history",
      })
    } catch (error) {
      console.error("Error removing product from history:", error)
      toast({
        title: "Error",
        description: "Failed to remove product from history",
        variant: "destructive",
      })
    }
  }

  // Handle form submission
  const handleFormSubmit = async (product: Product) => {
    setIsLoading(true)
    try {
      const savedProduct = await saveProduct(product)

      // Update the product in history
      const updatedHistory = history.map((p) =>
        p.id === product.id || p.barcode === product.barcode ? savedProduct : p,
      )

      setHistory(updatedHistory)
      localStorage.setItem("scanHistory", JSON.stringify(updatedHistory))

      toast({
        title: "Product updated",
        description: "Product has been successfully updated",
      })

      setShowForm(false)
    } catch (error) {
      console.error("Error updating product:", error)
      toast({
        title: "Error",
        description: "Failed to update product",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Clear all history
  const clearAllHistory = () => {
    localStorage.removeItem("scanHistory")
    setHistory([])
    setFilteredHistory([])
    toast({
      title: "History cleared",
      description: "All scan history has been cleared",
    })
  }

  // Get category name
  const getCategoryName = (product: Product): string => {
    if (typeof product.category === "string") {
      return product.category
    } else if (product.category && typeof product.category === "object" && "name" in product.category) {
      return product.category.name
    } else if (product.categories && typeof product.categories === "object" && "name" in product.categories) {
      return product.categories.name
    }
    return "Unknown"
  }

  const refreshHistory = () => {
    setRefreshTrigger((prev) => prev + 1)
    toast({
      title: "History refreshed",
      description: "The scan history has been refreshed",
    })
  }

  return (
    <div className="container py-6 max-w-6xl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold">Scan History</h1>
          <p className="text-muted-foreground">View and manage your product scan history</p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={refreshHistory}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" onClick={clearAllHistory} disabled={history.length === 0}>
            <Trash2 className="h-4 w-4 mr-2" />
            Clear All
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row justify-between gap-4">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or barcode"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>

            <div className="flex gap-2">
              <Select value={String(itemsPerPage)} onValueChange={(value) => setItemsPerPage(Number.parseInt(value))}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Rows per page" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 per page</SelectItem>
                  <SelectItem value="10">10 per page</SelectItem>
                  <SelectItem value="20">20 per page</SelectItem>
                  <SelectItem value="50">50 per page</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {filteredHistory.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <h3 className="text-lg font-medium">No products found</h3>
              <p className="text-muted-foreground mt-1">
                {searchQuery ? "No products match your search criteria" : "Your scan history is empty"}
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[300px]">
                        <Button
                          variant="ghost"
                          onClick={() => handleSort("name")}
                          className="flex items-center gap-1 font-medium"
                        >
                          Product
                          <ArrowUpDown className="h-3 w-3" />
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button
                          variant="ghost"
                          onClick={() => handleSort("price")}
                          className="flex items-center gap-1 font-medium"
                        >
                          Price
                          <ArrowUpDown className="h-3 w-3" />
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button
                          variant="ghost"
                          onClick={() => handleSort("stock")}
                          className="flex items-center gap-1 font-medium"
                        >
                          Stock
                          <BarChart4 className="h-3 w-3" />
                        </Button>
                      </TableHead>
                      <TableHead className="hidden md:table-cell">
                        <Button
                          variant="ghost"
                          onClick={() => handleSort("created_at")}
                          className="flex items-center gap-1 font-medium"
                        >
                          Date
                          <Calendar className="h-3 w-3" />
                        </Button>
                      </TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentItems.map((product, index) => (
                      <TableRow key={`${product.barcode}-${index}`}>
                        <TableCell className="font-medium">
                          <div className="flex flex-col">
                            <span className="truncate max-w-[250px]">{product.name}</span>
                            <span className="text-xs text-muted-foreground">{product.barcode || "No barcode"}</span>
                          </div>
                        </TableCell>
                        <TableCell>{product.price} DH</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {product.stock}
                            {product.isLowStock && (
                              <Badge variant="destructive" className="text-xs">
                                Low
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">{formatDate(product.created_at)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleViewProduct(product)}
                              title="View details"
                            >
                              <Search className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditProduct(product)}
                              title="Edit product"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteProduct(product)}
                              title="Remove from history"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination controls */}
              {totalPages > 1 && (
                <div className="flex justify-between items-center mt-4">
                  <div className="text-sm text-muted-foreground">
                    Showing {startIndex + 1}-{Math.min(endIndex, filteredHistory.length)} of {filteredHistory.length}
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => goToPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="h-8 w-8"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      <span className="sr-only">Previous page</span>
                    </Button>

                    <div className="text-sm mx-2">
                      Page {currentPage} of {totalPages}
                    </div>

                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => goToPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="h-8 w-8"
                    >
                      <ChevronRight className="h-4 w-4" />
                      <span className="sr-only">Next page</span>
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Product Edit Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Product</DialogTitle>
            <DialogDescription>Make changes to the product information below.</DialogDescription>
          </DialogHeader>

          {selectedProduct && (
            <ProductForm
              initialData={selectedProduct}
              categories={categories}
              onCancel={() => setShowForm(false)}
              onSuccess={handleFormSubmit}
              isLoading={isLoading}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Product Details Dialog */}
      <Dialog open={showProductDetails} onOpenChange={setShowProductDetails}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Product Details</DialogTitle>
            <DialogDescription>Detailed information about the selected product.</DialogDescription>
          </DialogHeader>

          {selectedProduct && (
            <div className="py-4">
              <ProductDisplay
                product={selectedProduct}
                onEdit={() => {
                  setShowProductDetails(false)
                  setShowForm(true)
                }}
              />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowProductDetails(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

