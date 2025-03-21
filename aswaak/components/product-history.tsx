"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Edit, Trash2, ChevronLeft, ChevronRight, MoreHorizontal, AlertTriangle, Search, RefreshCw } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import type { Product } from "@/types/product"
import { useSettings } from "@/contexts/settings-context"

interface ProductHistoryProps {
  onSelectProduct: (product: Product) => void
  onEditProduct?: (product: Product) => void
}

export function ProductHistory({ onSelectProduct, onEditProduct }: ProductHistoryProps) {
  const { settings } = useSettings()
  const [history, setHistory] = useState<Product[]>([])
  const [filteredHistory, setFilteredHistory] = useState<Product[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState("")
  const [itemsPerPage, setItemsPerPage] = useState(settings.display.historyItemsPerPage)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [productToDelete, setProductToDelete] = useState<Product | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  // Update itemsPerPage when settings change
  useEffect(() => {
    setItemsPerPage(settings.display.historyItemsPerPage)
  }, [settings.display.historyItemsPerPage])

  // Load history from localStorage
  useEffect(() => {
    const loadHistory = () => {
      const storedHistory = localStorage.getItem("scanHistory")
      if (storedHistory) {
        try {
          const parsedHistory = JSON.parse(storedHistory) as Product[]

          // Apply history retention settings
          const filteredByDate =
            settings.advanced.keepHistoryDays > 0
              ? filterHistoryByDate(parsedHistory, settings.advanced.keepHistoryDays)
              : parsedHistory

          // Apply max items limit
          const limitedHistory =
            settings.advanced.maxHistoryItems > 0
              ? filteredByDate.slice(0, settings.advanced.maxHistoryItems)
              : filteredByDate

          setHistory(limitedHistory)
          setFilteredHistory(limitedHistory)

          // If we filtered anything, update localStorage
          if (limitedHistory.length !== parsedHistory.length) {
            localStorage.setItem("scanHistory", JSON.stringify(limitedHistory))
          }
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
  }, [toast, refreshTrigger, settings.advanced.keepHistoryDays, settings.advanced.maxHistoryItems])

  // Helper function to filter history by date
  const filterHistoryByDate = (history: Product[], days: number): Product[] => {
    if (days <= 0) return history

    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)

    return history.filter((product) => {
      if (!product.created_at) return true
      const productDate = new Date(product.created_at)
      return productDate >= cutoffDate
    })
  }

  // Filter history when search query changes
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredHistory(history)
      setCurrentPage(1)
      return
    }

    const query = searchQuery.toLowerCase()
    const filtered = history.filter(
      (product) => product.name.toLowerCase().includes(query) || (product.barcode && product.barcode.includes(query)),
    )

    setFilteredHistory(filtered)
    setCurrentPage(1)
  }, [searchQuery, history])

  // Calculate pagination
  const totalPages = Math.ceil(filteredHistory.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentItems = filteredHistory.slice(startIndex, endIndex)

  // Handle product selection
  const handleProductClick = (product: Product) => {
    onSelectProduct(product)
  }

  // Handle product edit
  const handleEditProduct = (product: Product, e: React.MouseEvent) => {
    e.stopPropagation()
    if (onEditProduct) {
      onEditProduct(product)
    } else {
      onSelectProduct(product)
    }
  }

  // Handle product delete confirmation
  const handleDeleteClick = (product: Product, e: React.MouseEvent) => {
    e.stopPropagation()
    setProductToDelete(product)
    setDeleteConfirmOpen(true)
  }

  // Handle actual product deletion
  const handleDeleteConfirm = () => {
    if (!productToDelete) return

    setIsLoading(true)

    try {
      // Remove from history array
      const updatedHistory = history.filter((p) => p.barcode !== productToDelete.barcode || p.id !== productToDelete.id)

      // Update state
      setHistory(updatedHistory)
      setFilteredHistory(updatedHistory)

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
    } finally {
      setIsLoading(false)
      setDeleteConfirmOpen(false)
      setProductToDelete(null)
    }
  }

  // Handle page change
  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages) return
    setCurrentPage(page)
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

  const refreshHistory = () => {
    setRefreshTrigger((prev) => prev + 1)
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

  // Determine display style based on settings
  const isCompactView = settings.display.defaultView === "compact"

  return (
    <Card className="mb-4">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle>Scan History</CardTitle>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={refreshHistory} title="Refresh history">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={clearAllHistory} disabled={history.length === 0}>
            Clear All
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-4">
        {/* Search input */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or barcode"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>

        {filteredHistory.length === 0 ? (
          <div className="text-center py-8">
            <div className="flex justify-center mb-2">
              {searchQuery ? (
                <Search className="h-10 w-10 text-muted-foreground" />
              ) : (
                <AlertTriangle className="h-10 w-10 text-muted-foreground" />
              )}
            </div>
            <p className="text-muted-foreground">
              {searchQuery ? "No products match your search" : "No scan history available"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {currentItems.map((product, index) => (
              <div
                key={`${product.barcode}-${index}`}
                className={`p-3 border rounded-md cursor-pointer hover:bg-accent transition-colors ${
                  isCompactView ? "py-2" : ""
                }`}
                onClick={() => handleProductClick(product)}
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className={`font-medium truncate ${isCompactView ? "text-sm" : ""}`}>{product.name}</h3>
                      {product.isLowStock && (
                        <Badge variant="destructive" className="text-xs">
                          Low Stock
                        </Badge>
                      )}
                    </div>
                    {!isCompactView && (
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-sm text-muted-foreground mt-1">
                        <span>Barcode: {product.barcode || "N/A"}</span>
                        {product.created_at && <span className="hidden sm:inline">•</span>}
                        {product.created_at && <span>{formatDate(product.created_at)}</span>}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-end">
                    <span className={`font-bold ${isCompactView ? "text-sm" : ""}`}>{product.price} DH</span>
                    {!isCompactView && <span className="text-sm">Stock: {product.stock}</span>}

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className={`${isCompactView ? "h-6 w-6" : "h-8 w-8"} mt-1`}>
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => handleEditProduct(product, e as React.MouseEvent)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => handleDeleteClick(product, e as React.MouseEvent)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Remove from History
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <CardFooter className="flex justify-between items-center px-4 py-2 border-t">
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
        </CardFooter>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from History</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this product from your scan history? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isLoading}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isLoading ? (
                <>
                  <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Removing...
                </>
              ) : (
                "Remove"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

