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

// Function to fetch with timeout and better error handling
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = 10000): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    console.log(`Fetching ${url}`)
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    // Log response status
    console.log(`Response from ${url}: status=${response.status}`)

    return response
  } catch (error) {
    clearTimeout(timeoutId)
    console.error(`Fetch error for ${url}:`, error)
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

// Function to extract product info from HTML with better debugging
function extractProductInfoFromHTML(html: string, barcode: string, source: string): ProductInfo | null {
  try {
    console.log(`Extracting product info from HTML (${source}), HTML length: ${html.length}`)

    // Check for common error indicators - MORE PRECISE CHECK
    // Only consider it a 404 if it has a specific 404 heading or title
    const is404Page =
      (html.includes("<h1") && html.includes("404") && html.includes("Not Found")) ||
      (html.includes("<title") && html.includes("404") && html.includes("Not Found")) ||
      html.includes('<h2 class="entry-title">404') ||
      html.includes("We're sorry, but the page you were looking for doesn't exist.")

    if (is404Page) {
      console.log(`Found 404 page indicators in HTML from ${source}`)
      return null
    }

    // Check if this is a search results page with products
    // Look for specific product elements in the page
    const hasProducts =
      html.includes("product-inner") ||
      html.includes("product-loop-title") ||
      html.includes("woocommerce-loop-product__title") ||
      html.includes("product-image") ||
      html.includes("attachment-woocommerce_thumbnail")

    console.log(`Page has products: ${hasProducts}`)

    if (hasProducts) {
      console.log("Detected page with product listings")

      // Try to extract product info from search results
      // Extract product name from search results
      let name = ""
      let price = ""
      let image = "/placeholder.svg?height=200&width=200"

      // Product name patterns for search results
      const searchNamePatterns = [
        /<h3[^>]*class="[^"]*woocommerce-loop-product__title[^"]*"[^>]*>([\s\S]*?)<\/h3>/i,
        /<h2[^>]*class="[^"]*woocommerce-loop-product__title[^"]*"[^>]*>([\s\S]*?)<\/h2>/i,
        /<a[^>]*class="[^"]*product-loop-title[^"]*"[^>]*>([\s\S]*?)<\/a>/i,
        /<div[^>]*class="[^"]*product-title[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
        /<div[^>]*class="[^"]*product-name[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
        /<h1[^>]*>([\s\S]*?)<\/h1>/i, // Try h1 as a fallback
      ]

      for (const pattern of searchNamePatterns) {
        const matches = html.match(new RegExp(pattern, "g"))
        if (matches && matches.length > 0) {
          // Use the first match
          const firstMatch = matches[0].match(pattern)
          if (firstMatch && firstMatch[1]) {
            const extractedName = decodeHtmlEntities(firstMatch[1].replace(/<[^>]*>/g, "").trim())
            if (extractedName) {
              name = extractedName
              console.log(`Found product name in search results: "${name}" using pattern: ${pattern}`)
              break
            }
          }
        }
      }

      // If we still don't have a name, try to get it from the page title
      if (!name) {
        const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i)
        if (titleMatch && titleMatch[1]) {
          const title = decodeHtmlEntities(titleMatch[1].replace(/<[^>]*>/g, "").trim())
          // Remove site name if present
          const siteName = " - Aswak Assalam"
          const cleanTitle = title.includes(siteName) ? title.replace(siteName, "") : title
          if (cleanTitle && !cleanTitle.includes("404")) {
            name = cleanTitle
            console.log(`Using page title as product name: "${name}"`)
          }
        }
      }

      // Price patterns for search results
      const searchPricePatterns = [
        /<span[^>]*class="[^"]*price[^"]*"[^>]*>([\s\S]*?)Dh<\/span>/i,
        /<span[^>]*class="[^"]*price[^"]*"[^>]*>([\s\S]*?)<\/span>/i,
        /(\d+,\d+)\s*Dh/i,
        /(\d+\.\d+)\s*Dh/i,
      ]

      for (const pattern of searchPricePatterns) {
        const matches = html.match(new RegExp(pattern, "g"))
        if (matches && matches.length > 0) {
          // Use the first match
          const firstMatch = matches[0].match(pattern)
          if (firstMatch && firstMatch[1]) {
            const priceText = firstMatch[1].replace(/<[^>]*>/g, "").trim()
            const priceNumber = priceText.match(/[\d,.]+/)
            if (priceNumber) {
              price = priceNumber[0]
              console.log(`Found price in search results: ${price} using pattern: ${pattern}`)
              break
            }
          }
        }
      }

      // Image patterns for search results
      const searchImagePatterns = [
        /<img[^>]*class="[^"]*attachment-woocommerce_thumbnail[^"]*"[^>]*src="([^"]*)"[^>]*>/i,
        /<img[^>]*src="([^"]*)"[^>]*class="[^"]*attachment-woocommerce_thumbnail[^"]*"[^>]*>/i,
        /<img[^>]*class="[^"]*wp-post-image[^"]*"[^>]*src="([^"]*)"[^>]*>/i,
        /<img[^>]*src="([^"]*)"[^>]*class="[^"]*wp-post-image[^"]*"[^>]*>/i,
        /<img[^>]*src="([^"]*)"[^>]*alt="[^"]*"/i,
      ]

      for (const pattern of searchImagePatterns) {
        const matches = html.match(new RegExp(pattern, "g"))
        if (matches && matches.length > 0) {
          // Use the first match
          const firstMatch = matches[0].match(pattern)
          if (firstMatch && firstMatch[1]) {
            image = firstMatch[1]
            console.log(`Found image URL in search results: ${image} using pattern: ${pattern}`)
            break
          }
        }
      }

      // If we found a name, return the product info
      if (name) {
        return {
          name,
          price,
          image,
          barcode,
          source: `${source} (Search Results)`,
        }
      }
    }

    // If not a search results page or couldn't extract from search results,
    // continue with regular product page extraction

    // Extract product name
    let name = ""

    // Try multiple patterns for product name
    const namePatterns = [
      /<h1[^>]*class="[^"]*product_title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i,
      /<h1[^>]*>([\s\S]*?)<\/h1>/i,
      /<div[^>]*class="[^"]*product-title[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      /<span[^>]*class="[^"]*product-title[^"]*"[^>]*>([\s\S]*?)<\/span>/i,
      /<title>([\s\S]*?)<\/title>/i, // Try page title as fallback
    ]

    for (const pattern of namePatterns) {
      const match = html.match(pattern)
      if (match && match[1]) {
        const extractedName = decodeHtmlEntities(match[1].replace(/<[^>]*>/g, "").trim())
        if (extractedName && !extractedName.includes("Recherche") && !extractedName.includes("404")) {
          name = extractedName
          console.log(`Found product name: "${name}" using pattern: ${pattern}`)
          break
        }
      }
    }

    // Extract price
    let price = ""
    const pricePatterns = [
      /<span[^>]*class="[^"]*price[^"]*"[^>]*>([\s\S]*?)Dh<\/span>/i,
      /<span[^>]*class="[^"]*price[^"]*"[^>]*>([\s\S]*?)<\/span>/i,
      /<p[^>]*class="[^"]*price[^"]*"[^>]*>([\s\S]*?)<\/p>/i,
      /(\d+,\d+)\s*Dh/i,
      /(\d+\.\d+)\s*Dh/i,
    ]

    for (const pattern of pricePatterns) {
      const match = html.match(pattern)
      if (match && match[1]) {
        const priceText = match[1].replace(/<[^>]*>/g, "").trim()
        const priceNumber = priceText.match(/[\d,.]+/)
        if (priceNumber) {
          price = priceNumber[0]
          console.log(`Found price: ${price} using pattern: ${pattern}`)
          break
        }
      }
    }

    // Extract image URL
    let image = "/placeholder.svg?height=200&width=200"
    const imagePatterns = [
      /<img[^>]*id="og_image"[^>]*src="([^"]*)"[^>]*>/i,
      /<img[^>]*class="[^"]*product_image[^"]*"[^>]*src="([^"]*)"[^>]*>/i,
      /<img[^>]*class="[^"]*wp-post-image[^"]*"[^>]*src="([^"]*)"[^>]*>/i,
      /<img[^>]*src="([^"]*)"[^>]*class="[^"]*wp-post-image[^"]*"[^>]*>/i,
      /<div[^>]*class="[^"]*woocommerce-product-gallery__image[^"]*"[^>]*>[\s\S]*?<img[^>]*src="([^"]*)"[^>]*>/i,
    ]

    for (const pattern of imagePatterns) {
      const match = html.match(pattern)
      if (match && match[1]) {
        image = match[1]
        console.log(`Found image URL: ${image} using pattern: ${pattern}`)
        break
      }
    }

    // If we couldn't extract essential info, return null
    if (!name) {
      console.log(`Could not extract product name from HTML (${source})`)
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

// Function to fetch product info from aswakassalam.com - IMPROVED
async function fetchFromAswakAssalam(barcode: string, endpoint: string): Promise<ProductInfo | null> {
  try {
    console.log(`Attempting to fetch product from Aswak Assalam with barcode: ${barcode}, endpoint: ${endpoint}`)

    // Determine URL based on endpoint
    let url = ""
    if (endpoint === "aswak1") {
      url = `https://aswakassalam.com/ean1/${barcode}`
    } else if (endpoint === "aswak2") {
      url = `https://aswakassalam.com/ean2/${barcode}`
    } else {
      throw new Error(`Invalid Aswak Assalam endpoint: ${endpoint}`)
    }

    // Try multiple user agents in case of user agent filtering
    const userAgents = [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Mobile/15E148 Safari/604.1",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Safari/605.1.15",
    ]

    for (const userAgent of userAgents) {
      try {
        console.log(`Trying ${url} with user agent: ${userAgent.substring(0, 20)}...`)

        const response = await fetchWithTimeout(
          url,
          {
            headers: {
              "User-Agent": userAgent,
              Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
              "Accept-Language": "en-US,en;q=0.5",
              "Cache-Control": "no-cache",
              Pragma: "no-cache",
            },
          },
          10000, // 10 second timeout
        )

        if (!response.ok) {
          console.log(`Aswak Assalam ${url} returned status: ${response.status}`)
          continue
        }

        const html = await response.text()
        console.log(`Received HTML from ${url}, length: ${html.length} characters`)

        const productInfo = extractProductInfoFromHTML(html, barcode, `Aswak Assalam (${endpoint})`)
        if (productInfo && productInfo.name) {
          console.log(`Successfully extracted product info from ${url}:`, productInfo)
          return productInfo
        } else {
          console.log(`Failed to extract product info from ${url}`)
        }
      } catch (error) {
        console.error(`Error fetching from ${url} with user agent ${userAgent.substring(0, 20)}:`, error)
      }
    }

    console.log(`No product found on Aswak Assalam for barcode: ${barcode}, endpoint: ${endpoint}`)
    return null
  } catch (error) {
    console.error(`Error fetching from Aswak Assalam:`, error)
    return null
  }
}

// Function to fetch product info from Open Food Facts API - IMPROVED
async function fetchFromOpenFoodFactsAPI(barcode: string): Promise<ProductInfo | null> {
  try {
    console.log(`Attempting to fetch product from Open Food Facts API with barcode: ${barcode}`)

    // Try multiple user agents
    const userAgents = [
      "BarcodeScannerApp/1.0",
      "Mozilla/5.0 (compatible; ProductInfoBot/1.0)",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    ]

    for (const userAgent of userAgents) {
      try {
        const response = await fetchWithTimeout(
          `https://world.openfoodfacts.org/api/v2/product/${barcode}.json`,
          {
            headers: {
              "User-Agent": userAgent,
              "Cache-Control": "no-cache",
              Pragma: "no-cache",
            },
          },
          10000, // 10 second timeout
        )

        if (!response.ok) {
          console.log(`Open Food Facts API returned status: ${response.status} with user agent: ${userAgent}`)
          continue
        }

        const data = await response.json()
        console.log(`Open Food Facts API response status: ${data.status}`)

        if (data.status !== 1 || !data.product) {
          console.log("Open Food Facts API: Product not found or invalid response")
          continue
        }

        // Extract product information
        const product = data.product
        console.log(`Found product in Open Food Facts: ${product.product_name || "Unknown name"}`)

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
          console.log(`Using front image URL: ${imageUrl}`)
        }
        // Then try the regular image
        else if (product.image_url) {
          imageUrl = product.image_url
          console.log(`Using regular image URL: ${imageUrl}`)
        }
        // Then try selected images
        else if (product.selected_images?.front?.display?.url) {
          imageUrl = product.selected_images.front.display.url
          console.log(`Using selected image URL: ${imageUrl}`)
        }
        // Then try images object
        else if (product.images && Object.keys(product.images).length > 0) {
          // Get the first image key
          const firstImageKey = Object.keys(product.images)[0]
          if (product.images[firstImageKey].url) {
            imageUrl = product.images[firstImageKey].url
            console.log(`Using image from images object: ${imageUrl}`)
          }
        }

        // If no image was found, use a placeholder
        if (!imageUrl) {
          imageUrl = "/placeholder.svg?height=200&width=200"
          console.log("No image found, using placeholder")
        }

        // Create a product object with the extracted information
        const productInfo = {
          name,
          image: imageUrl,
          barcode,
          quantity: product.quantity || undefined,
          source: "Open Food Facts API",
        }

        console.log("Successfully extracted product info from Open Food Facts API:", productInfo)
        return productInfo
      } catch (error) {
        console.error(`Error fetching from Open Food Facts API with user agent ${userAgent}:`, error)
      }
    }

    console.log(`No product found on Open Food Facts API for barcode: ${barcode}`)
    return null
  } catch (error) {
    console.error(`Error fetching from Open Food Facts API:`, error)
    return null
  }
}

// Function to fetch product info from a specific source
export async function fetchProductInfoFromSource(barcode: string, source: string): Promise<ProductInfo | null> {
  // Check cache first
  const cacheKey = `${barcode}-${source}`
  const now = Date.now()
  const cachedProduct = productCache[cacheKey]
  if (cachedProduct && now - cachedProduct.timestamp < CACHE_TTL) {
    console.log(`Using cached product info for barcode: ${barcode}, source: ${source}`)
    return cachedProduct.data
  }

  console.log(`Starting product lookup for barcode: ${barcode} from source: ${source}`)

  let productInfo = null

  // Fetch from the specified source
  if (source === "aswak1") {
    productInfo = await fetchFromAswakAssalam(barcode, "aswak1")
  } else if (source === "aswak2") {
    productInfo = await fetchFromAswakAssalam(barcode, "aswak2")
  } else if (source === "openfoodfacts") {
    productInfo = await fetchFromOpenFoodFactsAPI(barcode)
  } else {
    throw new Error(`Unknown source: ${source}`)
  }

  // Cache the result if found
  if (productInfo) {
    console.log(`Found product info from ${source} for barcode: ${barcode}`)
    productCache[cacheKey] = { data: productInfo, timestamp: now }
  } else {
    console.log(`Product not found in ${source} for barcode: ${barcode}`)
  }

  return productInfo
}

// Optimized function to fetch product info from all sources in order
export async function fetchProductInfoFromAllSources(barcode: string): Promise<ProductInfo | null> {
  // Check cache first
  const now = Date.now()
  const cachedProduct = productCache[barcode]
  if (cachedProduct && now - cachedProduct.timestamp < CACHE_TTL) {
    console.log(`Using cached product info for barcode: ${barcode}`)
    return cachedProduct.data
  }

  console.log(`Starting product lookup for barcode: ${barcode}`)

  // Try sources in order (respecting priority)

  // 1. First try Aswak Assalam
  console.log("STEP 1: Trying Aswak Assalam")
  let productInfo = await fetchFromAswakAssalam(barcode, "aswak1")
  if (productInfo) {
    console.log("Found product info from Aswak Assalam (EAN1)")
    // Cache the result
    productCache[barcode] = { data: productInfo, timestamp: now }
    return productInfo
  }

  productInfo = await fetchFromAswakAssalam(barcode, "aswak2")
  if (productInfo) {
    console.log("Found product info from Aswak Assalam (EAN2)")
    // Cache the result
    productCache[barcode] = { data: productInfo, timestamp: now }
    return productInfo
  }

  // 2. Then try Open Food Facts API
  console.log("STEP 2: Trying Open Food Facts API")
  productInfo = await fetchFromOpenFoodFactsAPI(barcode)
  if (productInfo) {
    console.log("Found product info from Open Food Facts API")
    // Cache the result
    productCache[barcode] = { data: productInfo, timestamp: now }
    return productInfo
  }

  console.log(`Product not found in any source for barcode: ${barcode}`)
  return null
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const barcode = searchParams.get("barcode")
  const source = searchParams.get("source")

  if (!barcode) {
    return NextResponse.json({ error: "Barcode is required" }, { status: 400 })
  }

  try {
    console.log(`API route: Fetching product info for barcode: ${barcode}`)

    let productInfo = null

    if (source) {
      // If a specific source is requested, use only that source
      productInfo = await fetchProductInfoFromSource(barcode, source)
    } else {
      // Otherwise try all sources in order
      productInfo = await fetchProductInfoFromAllSources(barcode)
    }

    if (productInfo) {
      console.log(`Successfully found product info for barcode: ${barcode}`)
      return NextResponse.json(productInfo)
    }

    // If no product info was found from any source
    console.log(`No product info found for barcode: ${barcode}`)
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

