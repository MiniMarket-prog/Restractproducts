import { NextResponse } from "next/server"

// Define a type for product info
type ProductInfo = {
  name: string
  price?: string
  image: string
  barcode: string
  quantity?: string
  source?: string
}

// Simple in-memory cache for product info
const productCache: Record<string, { data: ProductInfo; timestamp: number }> = {}
const CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours in milliseconds

// Function to fetch with timeout
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = 5000): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    console.log(`Fetching ${url}`)
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    throw error
  }
}

// Function to decode HTML entities
function decodeHtmlEntities(text: string): string {
  if (!text) return ""

  const entities: Record<string, string> = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#039;": "'",
    "&rsquo;": "'",
    "&ldquo;": '"',
    "&rdquo;": '"',
    "&nbsp;": " ",
  }

  // Replace named entities
  let decodedText = text
  for (const [entity, char] of Object.entries(entities)) {
    decodedText = decodedText.replace(new RegExp(entity, "g"), char)
  }

  // Replace numeric entities (decimal)
  decodedText = decodedText.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(Number.parseInt(dec, 10)))

  // Replace numeric entities (hex)
  decodedText = decodedText.replace(/&#x([0-9a-f]+);/gi, (match, hex) => String.fromCharCode(Number.parseInt(hex, 16)))

  return decodedText
}

// Function to extract product info from HTML
function extractProductInfoFromHTML(html: string, barcode: string, source: string): ProductInfo | null {
  try {
    // Extract product name
    let name = ""

    // Try multiple patterns for product name
    const namePatterns = [
      /<h1[^>]*class="[^"]*product_title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i,
      /<h1[^>]*>([\s\S]*?)<\/h1>/i,
      /<div[^>]*class="[^"]*product-title[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      /<span[^>]*class="[^"]*product-title[^"]*"[^>]*>([\s\S]*?)<\/span>/i,
    ]

    for (const pattern of namePatterns) {
      const match = html.match(pattern)
      if (match && match[1]) {
        const extractedName = decodeHtmlEntities(match[1].replace(/<[^>]*>/g, "").trim())
        if (extractedName && !extractedName.includes("Recherche") && !extractedName.includes("404")) {
          name = extractedName
          break
        }
      }
    }

    // Extract price
    let price = ""
    const pricePatterns = [
      /<span[^>]*class="[^"]*price[^"]*"[^>]*>([\s\S]*?)Dh<\/span>/i,
      /<span[^>]*class="[^"]*price[^"]*"[^>]*>([\s\S]*?)<\/span>/i,
    ]

    for (const pattern of pricePatterns) {
      const match = html.match(pattern)
      if (match && match[1]) {
        const priceText = match[1].replace(/<[^>]*>/g, "").trim()
        const priceNumber = priceText.match(/[\d,.]+/)
        if (priceNumber) {
          price = priceNumber[0]
          break
        }
      }
    }

    // Extract image URL
    let image = "/placeholder.svg?height=200&width=200"
    const imagePatterns = [
      /<img[^>]*id="og_image"[^>]*src="([^"]*)"[^>]*>/i,
      /<img[^>]*class="[^"]*product_image[^"]*"[^>]*src="([^"]*)"[^>]*>/i,
      /<img[^>]*class="[^"]*wp-post-image[^>]*src="([^"]*)"[^>]*>/i,
    ]

    for (const pattern of imagePatterns) {
      const match = html.match(pattern)
      if (match && match[1]) {
        image = match[1]
        break
      }
    }

    // If we couldn't extract essential info, return null
    if (!name) {
      return null
    }

    return {
      name,
      price,
      image,
      barcode,
      source,
    }
  } catch (error) {
    console.error("Error extracting product info from HTML:", error)
    return null
  }
}

// Function to fetch product info from aswakassalam.com - OPTIMIZED
async function fetchFromAswakAssalam(barcode: string): Promise<ProductInfo | null> {
  try {
    // Only try the most likely URL patterns
    const urls = [`https://aswakassalam.com/ean1/${barcode}`, `https://aswakassalam.com/ean2/${barcode}`]

    const userAgent =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"

    for (const url of urls) {
      try {
        const response = await fetchWithTimeout(
          url,
          {
            headers: {
              "User-Agent": userAgent,
              Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
              "Accept-Language": "en-US,en;q=0.5",
            },
          },
          5000, // 5 second timeout
        )

        if (!response.ok) {
          console.log(`Aswak Assalam ${url} returned status: ${response.status}`)
          continue
        }

        const html = await response.text()

        // Check if it's a 404 page or search page with no results
        if (
          html.includes("404") ||
          html.includes("We're sorry, but the page you were looking for doesn't exist.") ||
          html.includes("Aucun résultat")
        ) {
          console.log(`Aswak Assalam ${url}: Product not found (404 or no results)`)
          continue
        }

        const productInfo = extractProductInfoFromHTML(html, barcode, `Aswak Assalam`)
        if (productInfo && productInfo.name) {
          return productInfo
        }
      } catch (error) {
        console.error(`Error fetching from ${url}:`, error)
      }
    }

    return null
  } catch (error) {
    console.error(`Error fetching from Aswak Assalam:`, error)
    return null
  }
}

// Function to fetch product info from French Open Food Facts website - OPTIMIZED
async function fetchFromFrenchOpenFoodFacts(barcode: string): Promise<ProductInfo | null> {
  try {
    const url = `https://fr.openfoodfacts.org/produit/${barcode}`
    const response = await fetchWithTimeout(
      url,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
        },
      },
      8000, // 8 second timeout
    )

    if (!response.ok) {
      console.log(`French Open Food Facts returned status: ${response.status}`)
      return null
    }

    const html = await response.text()

    // Check if it's an error page
    if (html.includes("Erreur") || html.includes("Adresse invalide")) {
      console.log("French Open Food Facts: Product not found (error page)")
      return null
    }

    // Extract product name
    let name = ""
    const nameRegex = /<h1[^>]*>([\s\S]*?)<\/h1>/i
    const nameMatch = html.match(nameRegex)
    if (nameMatch && nameMatch[1]) {
      name = decodeHtmlEntities(nameMatch[1].replace(/<[^>]*>/g, "").trim())
    }

    // Extract image URL
    let image = "/placeholder.svg?height=200&width=200"

    // First try to find the og_image
    const ogImageRegex = /<img[^>]*id="og_image"[^>]*src="([^"]*)"[^>]*>/i
    const ogImageMatch = html.match(ogImageRegex)
    if (ogImageMatch && ogImageMatch[1]) {
      console.log("Found og_image URL:", ogImageMatch[1])
      image = ogImageMatch[1]
    } else {
      // Try alternative image selector
      const altImageRegex = /<img[^>]*class="[^"]*product_image[^"]*"[^>]*src="([^"]*)"[^>]*>/i
      const altImageMatch = html.match(altImageRegex)
      if (altImageMatch && altImageMatch[1]) {
        console.log("Found alternative image URL:", altImageMatch[1])
        image = altImageMatch[1]
      }
    }

    // If we couldn't extract essential info, return null
    if (!name) {
      return null
    }

    return {
      name,
      image,
      barcode,
      source: "French Open Food Facts",
    }
  } catch (error) {
    console.error("Error fetching from French Open Food Facts:", error)
    return null
  }
}

// Function to fetch product info from Open Food Facts API - OPTIMIZED
async function fetchFromOpenFoodFactsAPI(barcode: string): Promise<ProductInfo | null> {
  try {
    const response = await fetchWithTimeout(
      `https://world.openfoodfacts.org/api/v2/product/${barcode}.json`,
      {
        headers: { "User-Agent": "BarcodeScannerApp/1.0" },
      },
      8000, // 8 second timeout
    )

    if (!response.ok) {
      console.log(`Open Food Facts API returned status: ${response.status}`)
      return null
    }

    const data = await response.json()

    if (data.status !== 1 || !data.product) {
      console.log("Open Food Facts API: Product not found or invalid response")
      return null
    }

    // Extract product information
    const product = data.product

    // Get product name
    let name = product.product_name || product.generic_name || `Product ${barcode}`

    // Add brand to the name if available and not already part of the name
    if (product.brands && !name.includes(product.brands)) {
      name = `${name} - ${decodeHtmlEntities(product.brands)}`
    }

    // Get the best available image URL
    let imageUrl = null

    // Try to get the front image first
    if (product.image_front_url) {
      imageUrl = product.image_front_url
    }
    // Then try the regular image
    else if (product.image_url) {
      imageUrl = product.image_url
    }
    // Then try selected images
    else if (product.selected_images?.front?.display?.url) {
      imageUrl = product.selected_images.front.display.url
    }
    // Then try images object
    else if (product.images && Object.keys(product.images).length > 0) {
      // Get the first image key
      const firstImageKey = Object.keys(product.images)[0]
      if (product.images[firstImageKey].url) {
        imageUrl = product.images[firstImageKey].url
      }
    }

    // If no image was found, use a placeholder
    if (!imageUrl) {
      imageUrl = "/placeholder.svg?height=200&width=200"
    }

    // Create a product object with the extracted information
    return {
      name,
      image: imageUrl,
      barcode,
      quantity: product.quantity || undefined,
      source: "Open Food Facts API",
    }
  } catch (error) {
    console.error("Error fetching from Open Food Facts API:", error)
    return null
  }
}

// Optimized function to fetch product info from all sources in parallel
async function fetchProductInfoFromAllSources(barcode: string): Promise<ProductInfo | null> {
  // Check cache first
  const now = Date.now()
  const cachedProduct = productCache[barcode]
  if (cachedProduct && now - cachedProduct.timestamp < CACHE_TTL) {
    console.log(`Using cached product info for barcode: ${barcode}`)
    return cachedProduct.data
  }

  // Start all fetches in parallel
  const aswakPromise = fetchFromAswakAssalam(barcode)
  const frenchOpenFoodFactsPromise = fetchFromFrenchOpenFoodFacts(barcode)
  const openFoodFactsAPIPromise = fetchFromOpenFoodFactsAPI(barcode)

  // Wait for Aswak Assalam result first (respecting priority)
  let productInfo = await aswakPromise
  if (productInfo) {
    console.log("Found product info from Aswak Assalam")
    // Cache the result
    productCache[barcode] = { data: productInfo, timestamp: now }
    return productInfo
  }

  // Then check French Open Food Facts
  productInfo = await frenchOpenFoodFactsPromise
  if (productInfo) {
    console.log("Found product info from French Open Food Facts")
    // Cache the result
    productCache[barcode] = { data: productInfo, timestamp: now }
    return productInfo
  }

  // Finally check Open Food Facts API
  productInfo = await openFoodFactsAPIPromise
  if (productInfo) {
    console.log("Found product info from Open Food Facts API")
    // Cache the result
    productCache[barcode] = { data: productInfo, timestamp: now }
    return productInfo
  }

  console.log("Product not found in any source")
  return null
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const barcode = searchParams.get("barcode")

  if (!barcode) {
    return NextResponse.json({ error: "Barcode is required" }, { status: 400 })
  }

  try {
    console.log(`API route: Fetching product info for barcode: ${barcode}`)

    const productInfo = await fetchProductInfoFromAllSources(barcode)

    if (productInfo) {
      return NextResponse.json(productInfo)
    }

    // If no product info was found from any source
    return NextResponse.json(
      {
        error: "Product not found",
        barcode,
      },
      { status: 404 },
    )
  } catch (error) {
    console.error("Error in API route:", error)
    return NextResponse.json(
      {
        error: "Failed to fetch product info",
        message: error instanceof Error ? error.message : String(error),
        barcode,
      },
      { status: 500 },
    )
  }
}

