"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Loader2, XCircle, Trash2, Save, AlertTriangle } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import type { Product } from "@/types/product"
import { useToast } from "@/hooks/use-toast"
import { supabase, isSupabaseInitialized } from "@/lib/supabase"

interface BatchProcessorProps {
  onProcessComplete?: (results: ProcessingResult[]) => void
}

export interface ProcessingResult {
  barcode: string
  success: boolean
  product?: Product
  error?: string
  selected?: boolean
}

interface SourceOption {
  id: string
  label: string
  url: string
  enabled: boolean
}

export function BatchBarcodeProcessor({ onProcessComplete }: BatchProcessorProps) {
  const [barcodeText, setBarcodeText] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [results, setResults] = useState<ProcessingResult[]>([])
  const [progress, setProgress] = useState(0)
  const [currentBarcode, setCurrentBarcode] = useState<string | null>(null)
  const [processedCount, setProcessedCount] = useState(0)
  const [totalBarcodes, setTotalBarcodes] = useState(0)
  const [usingClientSideFallback, setUsingClientSideFallback] = useState(false)
  const { toast } = useToast()

  // Update progress when processedCount changes
  useEffect(() => {
    if (totalBarcodes > 0) {
      const calculatedProgress = Math.round((processedCount / totalBarcodes) * 100)
      setProgress(calculatedProgress)
    }
  }, [processedCount, totalBarcodes])

  // Source options
  const [sources, setSources] = useState<SourceOption[]>([
    { id: "aswak1", label: "Aswak Assalam (EAN1)", url: "https://aswakassalam.com/ean1/{barcode}", enabled: true },
    { id: "aswak2", label: "Aswak Assalam (EAN2)", url: "https://aswakassalam.com/ean2/{barcode}", enabled: true },
    {
      id: "openfoodfacts",
      label: "Open Food Facts API",
      url: "https://world.openfoodfacts.org/api/v2/product/{barcode}.json",
      enabled: true,
    },
  ])

  const toggleSource = (sourceId: string) => {
    setSources(sources.map((source) => (source.id === sourceId ? { ...source, enabled: !source.enabled } : source)))
  }

  const parseBarcodes = (text: string): string[] => {
    return text
      .split(/[\n,]/)
      .map((code) => code.trim())
      .filter((code) => code.length > 0)
  }

  // Client-side fallback for processing barcodes
  const processBarcodesClientSide = async (barcodes: string[]) => {
    setUsingClientSideFallback(true)
    const allResults: ProcessingResult[] = []

    // Process one barcode at a time
    for (let i = 0; i < barcodes.length; i++) {
      const barcode = barcodes[i]
      setCurrentBarcode(barcode)

      try {
        // Try Open Food Facts API directly from the client
        const result = await fetchFromOpenFoodFactsClientSide(barcode)
        allResults.push(result)
      } catch (error) {
        console.error(`Error processing barcode ${barcode} client-side:`, error)
        allResults.push({
          barcode,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error occurred",
        })
      }

      // Update processed count
      setProcessedCount(i + 1)
    }

    return allResults
  }

  // Client-side function to fetch from Open Food Facts API
  const fetchFromOpenFoodFactsClientSide = async (barcode: string): Promise<ProcessingResult> => {
    try {
      const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`)

      if (!response.ok) {
        return {
          barcode,
          success: false,
          error: `API returned status ${response.status}`,
        }
      }

      const data = await response.json()

      if (data.status !== 1 || !data.product) {
        return {
          barcode,
          success: false,
          error: "Product not found in Open Food Facts",
        }
      }

      // Extract product information
      const product = data.product

      // Get product name
      let name = product.product_name || product.generic_name || `Product ${barcode}`

      // Add brand to the name if available
      if (product.brands && !name.includes(product.brands)) {
        name = `${name} - ${product.brands}`
      }

      // Get image URL
      let imageUrl = product.image_front_url || product.image_url || ""

      if (!imageUrl && product.selected_images?.front?.display?.url) {
        imageUrl = product.selected_images.front.display.url
      }

      // Create product object
      const productInfo: Product = {
        name,
        barcode,
        image: imageUrl,
        price: "",
        stock: 0,
        min_stock: 0,
        data_source: "Open Food Facts API (Client-side)",
      }

      return {
        barcode,
        success: true,
        product: productInfo,
        selected: true,
      }
    } catch (error) {
      console.error(`Error fetching from Open Food Facts API for ${barcode}:`, error)
      return {
        barcode,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      }
    }
  }

  // Process the barcodes
  const processBarcodes = async () => {
    const barcodes = parseBarcodes(barcodeText)

    if (barcodes.length === 0) return

    setIsProcessing(true)
    setResults([])
    setProgress(0)
    setProcessedCount(0)
    setTotalBarcodes(barcodes.length)
    setUsingClientSideFallback(false)
    setCurrentBarcode(null)

    try {
      // Get enabled sources
      const enabledSources = sources.filter((s) => s.enabled).map((s) => s.id)

      if (enabledSources.length === 0) {
        throw new Error("Please select at least one source to search")
      }

      console.log(`Processing ${barcodes.length} barcodes with sources:`, enabledSources)

      // Start progress animation immediately
      let progressValue = 0
      const progressInterval = setInterval(() => {
        progressValue += 1
        // Cap at 90% until we get actual results
        if (progressValue <= 90) {
          setProgress(progressValue)
        }
      }, 100)

      try {
        // First try with a very small batch to test if the server is responsive
        const testBatch = barcodes.slice(0, 2)
        let serverIsResponsive = true

        try {
          const testResponse = await fetch("/api/batch-process", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              barcodes: testBatch,
              sources: enabledSources,
            }),
            signal: AbortSignal.timeout(15000), // 15 second timeout for test
          })

          if (!testResponse.ok) {
            console.warn("Server test request failed, switching to client-side processing")
            serverIsResponsive = false
          }
        } catch (error) {
          console.warn("Server test request failed with error, switching to client-side processing:", error)
          serverIsResponsive = false
        }

        let allResults: ProcessingResult[] = []

        // If server is not responsive, use client-side processing for all barcodes
        if (!serverIsResponsive) {
          toast({
            title: "Server Timeout",
            description: "Using client-side processing as a fallback. Only Open Food Facts API will be available.",
            variant: "default", // Changed from "warning" to "default"
          })

          allResults = await processBarcodesClientSide(barcodes)
        } else {
          // Process in smaller batches to avoid timeouts
          const BATCH_SIZE = 5 // Process 5 barcodes at a time

          for (let i = 0; i < barcodes.length; i += BATCH_SIZE) {
            const batchBarcodes = barcodes.slice(i, i + BATCH_SIZE)
            console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1} with ${batchBarcodes.length} barcodes`)

            try {
              // Use the server-side batch processing API
              const response = await fetch("/api/batch-process", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  barcodes: batchBarcodes,
                  sources: enabledSources,
                }),
                signal: AbortSignal.timeout(20000), // 20 second timeout
              })

              if (!response.ok) {
                // If server fails, process this batch client-side
                console.warn(`Server responded with ${response.status}, processing batch client-side`)

                // Process this batch client-side
                const clientResults = await processBarcodesClientSide(batchBarcodes)
                allResults.push(...clientResults)
                continue
              }

              const data = await response.json()
              console.log(`Batch ${Math.floor(i / BATCH_SIZE) + 1} response:`, data)

              // Convert API results to our format
              const processedResults: ProcessingResult[] = data.results.map((result: any) => {
                if (result.success) {
                  // Create a product object from the API response
                  const product: Product = {
                    name: result.data.name,
                    barcode: result.barcode,
                    image: result.data.image,
                    price: result.data.price || "",
                    stock: 0, // Default stock
                    min_stock: 0, // Default min stock
                    data_source: result.data.source,
                  }

                  return {
                    barcode: result.barcode,
                    success: true,
                    product,
                    selected: true, // Default to selected
                  }
                } else {
                  return {
                    barcode: result.barcode,
                    success: false,
                    error: result.error || "Product not found",
                  }
                }
              })

              allResults.push(...processedResults)

              // Update processed count
              setProcessedCount(Math.min(i + BATCH_SIZE, barcodes.length))

              // Add a small delay between batches
              if (i + BATCH_SIZE < barcodes.length) {
                await new Promise((resolve) => setTimeout(resolve, 500))
              }
            } catch (error) {
              console.error(`Error processing batch ${Math.floor(i / BATCH_SIZE) + 1}:`, error)

              // If server request fails, process this batch client-side
              console.warn("Server request failed, processing batch client-side")
              const clientResults = await processBarcodesClientSide(batchBarcodes)
              allResults.push(...clientResults)
            }
          }
        }

        console.log("All batches processed, total results:", allResults.length)
        setResults(allResults)
        setProcessedCount(barcodes.length)

        if (onProcessComplete) {
          onProcessComplete(allResults)
        }
      } finally {
        // Clear the interval and set progress to 100% when done
        clearInterval(progressInterval)
        setProgress(100)
      }
    } catch (error) {
      console.error("Error processing barcodes:", error)
      setProgress(0)

      // Show error in results
      setResults([
        {
          barcode: "Error",
          success: false,
          error: error instanceof Error ? error.message : "Unknown error occurred",
        },
      ])
    } finally {
      setIsProcessing(false)
      setCurrentBarcode(null)
    }
  }

  // Save products to database
  const saveProductsToDatabase = async () => {
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
    setProgress(0)
    setProcessedCount(0)
    setTotalBarcodes(selectedResults.length)

    try {
      let savedCount = 0
      let errorCount = 0
      let newProductsCount = 0
      let updatedProductsCount = 0

      for (let i = 0; i < selectedResults.length; i++) {
        const result = selectedResults[i]

        if (result.product) {
          try {
            console.log(`Processing product: ${result.barcode}`, result.product)

            // First check if the product already exists
            const { data: existingProduct, error: lookupError } = await supabase
              .from("products")
              .select("id, name, image")
              .eq("barcode", result.barcode)
              .single()

            if (lookupError && lookupError.code !== "PGRST116") {
              // PGRST116 is "not found" error, which is expected for new products
              console.error(`Error looking up product ${result.barcode}:`, lookupError)
              errorCount++
              continue
            }

            let saveResult

            if (existingProduct) {
              // Update ONLY name and image for existing product
              console.log(`Product ${result.barcode} already exists, updating name and image only...`)

              // Only update if the new data is different
              if (existingProduct.name !== result.product.name || existingProduct.image !== result.product.image) {
                saveResult = await supabase
                  .from("products")
                  .update({
                    name: result.product.name,
                    image: result.product.image,
                    // Removed updated_at as it doesn't exist in your schema
                  })
                  .eq("id", existingProduct.id)

                if (saveResult.error) {
                  console.error(`Error updating product ${result.barcode}:`, saveResult.error)
                  errorCount++
                } else {
                  console.log(`Successfully updated product: ${result.barcode}`)
                  updatedProductsCount++
                  savedCount++
                }
              } else {
                console.log(`Product ${result.barcode} already has the same name and image, skipping update`)
                savedCount++ // Count as saved even though no changes were made
              }
            } else {
              // Insert new product with minimal required fields
              console.log(`Product ${result.barcode} does not exist, creating new record with minimal fields`)
              saveResult = await supabase.from("products").insert({
                barcode: result.barcode,
                name: result.product.name,
                image: result.product.image,
                stock: 0, // Default stock
                min_stock: 5, // Default min stock based on your schema
                // created_at will be set automatically by your default value now()
              })

              if (saveResult.error) {
                console.error(`Error creating product ${result.barcode}:`, saveResult.error)
                errorCount++
              } else {
                console.log(`Successfully created new product: ${result.barcode}`)
                newProductsCount++
                savedCount++
              }
            }
          } catch (error) {
            console.error(`Error saving product ${result.barcode}:`, error)
            errorCount++
          }
        }

        // Update progress after each product
        setProcessedCount(i + 1)
      }

      toast({
        title: "Products Saved",
        description: `Successfully processed ${savedCount} products (${newProductsCount} new, ${updatedProductsCount} updated). Failed: ${errorCount}`,
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
      setProgress(100) // Ensure progress is complete
    }
  }

  // Toggle selection of a result
  const toggleResultSelection = (index: number) => {
    setResults(results.map((result, i) => (i === index ? { ...result, selected: !result.selected } : result)))
  }

  // Remove a result
  const removeResult = (index: number) => {
    setResults(results.filter((_, i) => i !== index))
  }

  // Get selected results
  const getSelectedResults = () => {
    return results.filter((r) => r.success && r.product && r.selected)
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Batch Barcode Processor</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="barcodes" className="text-sm font-medium">
            Enter barcodes (one per line or comma-separated)
          </label>
          <Textarea
            id="barcodes"
            placeholder="e.g. 8414227057648&#10;8414227057723&#10;8420568030806"
            value={barcodeText}
            onChange={(e) => setBarcodeText(e.target.value)}
            disabled={isProcessing}
            className="min-h-[150px]"
          />
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-medium">Search Sources</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {sources.map((source) => (
              <div key={source.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`source-${source.id}`}
                  checked={source.enabled}
                  onCheckedChange={() => toggleSource(source.id)}
                  disabled={isProcessing}
                />
                <Label htmlFor={`source-${source.id}`} className="text-sm">
                  {source.label}
                </Label>
              </div>
            ))}
          </div>
        </div>

        {usingClientSideFallback && (
          <Alert variant="default" className="bg-amber-50 border-amber-200">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-700">
              Using client-side processing due to server timeout. Only Open Food Facts API is available in this mode.
            </AlertDescription>
          </Alert>
        )}

        {(isProcessing || isSaving) && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm">{isProcessing ? "Processing barcodes..." : "Saving products..."}</span>
              <span className="text-sm font-medium">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
            <div className="text-center text-sm text-muted-foreground">
              {processedCount} of {totalBarcodes} {isProcessing ? "processed" : "saved"}
              {currentBarcode && <div className="mt-1">Current: {currentBarcode}</div>}
            </div>
          </div>
        )}

        {results.length > 0 && !isProcessing && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Results</h3>
              <div className="text-sm text-muted-foreground">
                Selected: {getSelectedResults().length} of {results.filter((r) => r.success).length} found
              </div>
            </div>

            <div className="border rounded-md divide-y">
              {results.map((result, index) => (
                <div key={index} className="p-3 flex items-start gap-3">
                  {result.success ? (
                    <>
                      {result.product?.image && (
                        <img
                          src={result.product.image || "/placeholder.svg"}
                          alt={result.product.name}
                          className="w-12 h-12 object-contain flex-shrink-0"
                          onError={(e) => {
                            ;(e.target as HTMLImageElement).src = "/placeholder.svg?height=48&width=48"
                          }}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`select-${index}`}
                            checked={result.selected}
                            onCheckedChange={() => toggleResultSelection(index)}
                          />
                          <Label htmlFor={`select-${index}`} className="font-medium truncate">
                            {result.product?.name}
                          </Label>
                        </div>
                        <p className="text-sm text-gray-500">Barcode: {result.barcode}</p>
                        {result.product?.data_source && (
                          <p className="text-xs text-gray-400">Source: {result.product.data_source}</p>
                        )}
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => removeResult(index)} className="flex-shrink-0">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">Barcode: {result.barcode}</p>
                        <p className="text-sm text-red-500">{result.error}</p>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => removeResult(index)} className="flex-shrink-0">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-between text-sm">
              <span>Total: {results.length}</span>
              <span>Found: {results.filter((r) => r.success).length}</span>
              <span>Not Found: {results.filter((r) => !r.success).length}</span>
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-col gap-2">
        <Button onClick={processBarcodes} disabled={isProcessing || !barcodeText.trim()} className="w-full">
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            "Process Barcodes"
          )}
        </Button>

        {results.length > 0 && !isProcessing && (
          <Button
            onClick={saveProductsToDatabase}
            disabled={isSaving || getSelectedResults().length === 0}
            className="w-full bg-green-600 hover:bg-green-700"
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving to Database...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Update {getSelectedResults().length} Products
              </>
            )}
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}

