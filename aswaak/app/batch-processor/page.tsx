"use client"

import { useState } from "react"
import { BatchBarcodeProcessor, type ProcessingResult } from "@/components/batch-barcode-processor"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { AlertCircle, Loader2, ExternalLink, Save } from "lucide-react"
import { supabase, isSupabaseInitialized } from "@/lib/supabase"

export default function BatchProcessorPage() {
  const [results, setResults] = useState<ProcessingResult[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const { toast } = useToast()

  const handleProcessComplete = (processResults: ProcessingResult[]) => {
    setResults(processResults)
  }

  const handleSaveAll = async () => {
    const selectedResults = results.filter((r) => r.success && r.product && r.selected)

    if (selectedResults.length === 0) {
      toast({
        title: "No Products Selected",
        description: "Please select at least one product to save to the database.",
        variant: "destructive",
      })
      return
    }

    if (!isSupabaseInitialized()) {
      toast({
        title: "Database Not Available",
        description: "Supabase client is not initialized. Cannot save products.",
        variant: "destructive",
      })
      return
    }

    setIsSaving(true)

    try {
      let savedCount = 0
      let errorCount = 0

      for (const result of selectedResults) {
        if (result.product) {
          try {
            console.log(`Saving product: ${result.barcode}`, result.product)

            // Create a new product without an ID (the database will assign one)
            const productToSave = {
              barcode: result.product.barcode,
              name: result.product.name,
              price: result.product.price || "",
              stock: 0, // Default stock
              min_stock: 0, // Default min stock
              image: result.product.image,
              data_source: result.product.data_source,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              created_by: "batch_processor",
              updated_by: "batch_processor",
            }

            // First check if the product already exists
            const { data: existingProduct } = await supabase
              .from("products")
              .select("id")
              .eq("barcode", result.product.barcode)
              .single()

            let saveResult

            if (existingProduct) {
              // Update existing product
              console.log(`Product ${result.barcode} already exists, updating...`)
              saveResult = await supabase
                .from("products")
                .update({
                  name: result.product.name,
                  image: result.product.image,
                  data_source: result.product.data_source,
                  updated_at: new Date().toISOString(),
                  updated_by: "batch_processor",
                })
                .eq("id", existingProduct.id)
            } else {
              // Insert new product
              saveResult = await supabase.from("products").insert(productToSave)
            }

            if (saveResult.error) {
              console.error(`Error saving product ${result.barcode}:`, saveResult.error)
              errorCount++
            } else {
              console.log(`Successfully saved product: ${result.barcode}`)
              savedCount++
            }
          } catch (error) {
            console.error(`Error saving product ${result.barcode}:`, error)
            errorCount++
          }
        }
      }

      toast({
        title: "Products Saved",
        description: `Successfully saved ${savedCount} products. Failed: ${errorCount}`,
        variant: errorCount > 0 ? "destructive" : "default",
      })
    } catch (error) {
      toast({
        title: "Error Saving Products",
        description: `An error occurred while saving products: ${error instanceof Error ? error.message : String(error)}`,
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleExportCSV = () => {
    const selectedResults = results.filter((r) => r.success && r.product && r.selected)

    if (selectedResults.length === 0) {
      toast({
        title: "No Products Selected",
        description: "Please select at least one product to export.",
        variant: "destructive",
      })
      return
    }

    // Create CSV content
    const headers = ["barcode", "name", "price", "image", "source"]
    const csvContent = [
      headers.join(","),
      ...selectedResults.map((result) => {
        const product = result.product!
        return [
          product.barcode,
          `"${(product.name || "").replace(/"/g, '""')}"`,
          product.price || "",
          product.image || "",
          `"${(product.data_source || "").replace(/"/g, '""')}"`,
        ].join(",")
      }),
    ].join("\n")

    // Create and download the file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", `products_${new Date().toISOString().slice(0, 10)}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const getSelectedCount = () => {
    return results.filter((r) => r.success && r.product && r.selected).length
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Batch Barcode Processor</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <BatchBarcodeProcessor onProcessComplete={handleProcessComplete} />
        </div>

        <div className="space-y-6">
          {results.length > 0 && (
            <Card>
              <CardContent className="pt-6">
                <h2 className="text-xl font-semibold mb-4">Processing Summary</h2>
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-muted rounded-md p-4 text-center">
                    <div className="text-2xl font-bold">{results.length}</div>
                    <div className="text-sm text-muted-foreground">Total</div>
                  </div>
                  <div className="bg-muted rounded-md p-4 text-center">
                    <div className="text-2xl font-bold text-green-600">{results.filter((r) => r.success).length}</div>
                    <div className="text-sm text-muted-foreground">Found</div>
                  </div>
                  <div className="bg-muted rounded-md p-4 text-center">
                    <div className="text-2xl font-bold text-blue-600">{getSelectedCount()}</div>
                    <div className="text-sm text-muted-foreground">Selected</div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <Button onClick={handleSaveAll} disabled={isSaving || getSelectedCount() === 0} className="flex-1">
                    {isSaving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save Selected to Database
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleExportCSV}
                    disabled={getSelectedCount() === 0}
                    className="flex-1"
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Export Selected to CSV
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {results.filter((r) => r.success).length > 0 && (
            <Card>
              <CardContent className="pt-6">
                <h2 className="text-xl font-semibold mb-4">Found Products</h2>
                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                  {results
                    .filter((r) => r.success && r.product)
                    .map((result, index) => (
                      <div
                        key={index}
                        className={`flex gap-3 border rounded-md p-3 ${result.selected ? "border-blue-200 bg-blue-50" : ""}`}
                      >
                        {result.product?.image && (
                          <img
                            src={result.product.image || "/placeholder.svg"}
                            alt={result.product.name}
                            className="w-16 h-16 object-contain"
                            onError={(e) => {
                              ;(e.target as HTMLImageElement).src = "/placeholder.svg?height=64&width=64"
                            }}
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={result.selected}
                              onChange={() => {
                                const updatedResults = [...results]
                                updatedResults[index].selected = !updatedResults[index].selected
                                setResults(updatedResults)
                              }}
                              className="rounded border-gray-300"
                            />
                            <p className="font-medium">{result.product?.name}</p>
                          </div>
                          <p className="text-sm text-gray-500">Barcode: {result.barcode}</p>
                          {result.product?.data_source && (
                            <p className="text-xs text-gray-400">Source: {result.product.data_source}</p>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}

          {results.filter((r) => !r.success).length > 0 && (
            <Card>
              <CardContent className="pt-6">
                <h2 className="text-xl font-semibold mb-4 text-red-600">Not Found</h2>
                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                  {results
                    .filter((r) => !r.success)
                    .map((result, index) => (
                      <div key={index} className="flex gap-3 border border-red-200 bg-red-50 rounded-md p-3">
                        <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium">Barcode: {result.barcode}</p>
                          <p className="text-sm text-red-500">{result.error}</p>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

