import { NextResponse } from "next/server"
import { fetchProductInfoFromSource } from "../fetch-product/route"

// Add more detailed logging to the POST function
export async function POST(request: Request) {
  try {
    const { barcodes, sources } = await request.json()
    console.log(`Received batch process request for ${barcodes.length} barcodes with sources:`, sources)

    if (!barcodes || !Array.isArray(barcodes) || barcodes.length === 0) {
      return NextResponse.json({ error: "Valid barcodes array is required" }, { status: 400 })
    }

    // Validate sources
    const validSources = sources || ["aswak1", "aswak2", "openfoodfacts"]
    console.log("Using sources:", validSources)

    // Limit the number of barcodes to process
    const MAX_BARCODES = 100
    const barcodesToProcess = barcodes.slice(0, MAX_BARCODES)
    console.log(`Processing ${barcodesToProcess.length} barcodes (limited to ${MAX_BARCODES})`)

    // Process barcodes in parallel with a concurrency limit
    const CONCURRENCY_LIMIT = 5
    const results = []

    for (let i = 0; i < barcodesToProcess.length; i += CONCURRENCY_LIMIT) {
      const batch = barcodesToProcess.slice(i, i + CONCURRENCY_LIMIT)
      console.log(`Processing batch ${Math.floor(i / CONCURRENCY_LIMIT) + 1} with ${batch.length} barcodes`)

      const batchPromises = batch.map(async (barcode) => {
        try {
          console.log(`Processing barcode: ${barcode}`)
          // Try each source in order until we find product info
          for (const source of validSources) {
            console.log(`Trying source ${source} for barcode ${barcode}`)
            const productInfo = await fetchProductInfoFromSource(barcode, source)

            if (productInfo) {
              console.log(`Found product info for barcode ${barcode} from source ${source}:`, productInfo)
              return {
                barcode,
                success: true,
                data: productInfo,
              }
            }
          }

          console.log(`No product found for barcode ${barcode} in any selected source`)
          // If we get here, no source had product info
          return {
            barcode,
            success: false,
            error: "Product not found in any selected source",
          }
        } catch (error) {
          console.error(`Error processing barcode ${barcode}:`, error)
          return {
            barcode,
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          }
        }
      })

      const batchResults = await Promise.all(batchPromises)
      console.log(
        `Batch ${Math.floor(i / CONCURRENCY_LIMIT) + 1} results:`,
        batchResults.map((r) => ({ barcode: r.barcode, success: r.success })),
      )
      results.push(...batchResults)

      // Add a small delay between batches to avoid rate limiting
      if (i + CONCURRENCY_LIMIT < barcodesToProcess.length) {
        console.log("Adding delay between batches")
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    }

    const successCount = results.filter((r) => r.success).length
    const failCount = results.filter((r) => !r.success).length
    console.log(`Batch processing complete. Total: ${results.length}, Success: ${successCount}, Failed: ${failCount}`)

    return NextResponse.json({
      success: true,
      total: barcodesToProcess.length,
      found: successCount,
      notFound: failCount,
      results,
    })
  } catch (error) {
    console.error("Error in batch processing:", error)
    return NextResponse.json(
      {
        error: "Failed to process barcodes",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}

