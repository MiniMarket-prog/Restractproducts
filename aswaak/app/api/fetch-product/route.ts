import { NextResponse } from "next/server"

// Define a type for product info that includes the optional notFound property
type ProductInfo = {
  name: string
  price: string
  image: string
  category: string
  isInStock: boolean
  notFound?: boolean
  source?: string // Add source to track which website provided the data
  quantity?: string // Add quantity field
}

// Define an interface for website scrapers
interface WebsiteScraper {
  name: string
  baseUrl: string
  urlPatterns: string[] // Different URL patterns to try
  userAgents: string[] // User agents to try
  extractProductInfo: (html: string, barcode: string) => ProductInfo
  isNotFoundPage: (html: string) => boolean
}

// Different user agents to try
const userAgents = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Mobile/15E148 Safari/604.1",
]

// Function to decode HTML entities
function decodeHtmlEntities(text: string): string {
  if (!text) return ""

  const entities: Record<string, string> = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#039;": "'",
    "&#39;": "'",
    "&rsquo;": "'",
    "&lsquo;": "'",
    "&rdquo;": '"',
    "&ldquo;": '"',
    "&ndash;": "–",
    "&mdash;": "—",
    "&nbsp;": " ",
    "&copy;": "©",
    "&reg;": "®",
    "&trade;": "™",
    "&euro;": "€",
    "&pound;": "£",
    "&yen;": "¥",
    "&cent;": "¢",
    "&sect;": "§",
    "&deg;": "°",
    "&bull;": "•",
    "&hellip;": "…",
    "&prime;": "′",
    "&Prime;": "″",
    "&frasl;": "/",
    "&times;": "×",
    "&divide;": "÷",
    "&plusmn;": "±",
    "&minus;": "−",
    "&sup1;": "¹",
    "&sup2;": "²",
    "&sup3;": "³",
    "&frac14;": "¼",
    "&frac12;": "½",
    "&frac34;": "¾",
    "&permil;": "‰",
    "&micro;": "µ",
    "&para;": "¶",
    "&middot;": "·",
    "&cedil;": "¸",
    "&ordf;": "ª",
    "&ordm;": "º",
    "&not;": "¬",
    "&shy;": "­",
    "&macr;": "¯",
    "&acute;": "´",
    "&uml;": "¨",
    "&circ;": "ˆ",
    "&tilde;": "˜",
    "&iexcl;": "¡",
    "&iquest;": "¿",
    "&szlig;": "ß",
    "&agrave;": "à",
    "&aacute;": "á",
    "&acirc;": "â",
    "&atilde;": "ã",
    "&auml;": "ä",
    "&aring;": "å",
    "&aelig;": "æ",
    "&ccedil;": "ç",
    "&egrave;": "è",
    "&eacute;": "é",
    "&ecirc;": "ê",
    "&euml;": "ë",
    "&igrave;": "ì",
    "&iacute;": "í",
    "&icirc;": "î",
    "&iuml;": "ï",
    "&eth;": "ð",
    "&ntilde;": "ñ",
    "&ograve;": "ò",
    "&oacute;": "ó",
    "&ocirc;": "ô",
    "&otilde;": "õ",
    "&ouml;": "ö",
    "&oslash;": "ø",
    "&ugrave;": "ù",
    "&uacute;": "ú",
    "&ucirc;": "û",
    "&uuml;": "ü",
    "&yacute;": "ý",
    "&thorn;": "þ",
    "&yuml;": "ÿ",
    "&Agrave;": "À",
    "&Aacute;": "Á",
    "&Acirc;": "Â",
    "&Atilde;": "Ã",
    "&Auml;": "Ä",
    "&Aring;": "Å",
    "&AElig;": "Æ",
    "&Ccedil;": "Ç",
    "&Egrave;": "È",
    "&Eacute;": "É",
    "&Ecirc;": "Ê",
    "&Euml;": "Ë",
    "&Igrave;": "Ì",
    "&Iacute;": "Í",
    "&Icirc;": "Î",
    "&Iuml;": "Ï",
    "&ETH;": "Ð",
    "&Ntilde;": "Ñ",
    "&Ograve;": "Ò",
    "&Oacute;": "Ó",
    "&Ocirc;": "Ô",
    "&Otilde;": "Õ",
    "&Ouml;": "Ö",
    "&Oslash;": "Ø",
    "&Ugrave;": "Ù",
    "&Uacute;": "Ú",
    "&Ucirc;": "Û",
    "&Uuml;": "Ü",
    "&Yacute;": "Ý",
    "&THORN;": "Þ",
    "&Yuml;": "Ÿ",
  }

  // Replace named entities
  let decodedText = text

  // Replace all named entities
  for (const [entity, char] of Object.entries(entities)) {
    decodedText = decodedText.replace(new RegExp(entity, "g"), char)
  }

  // Replace numeric entities (decimal)
  decodedText = decodedText.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(Number.parseInt(dec, 10)))

  // Replace numeric entities (hex)
  decodedText = decodedText.replace(/&#x([0-9a-f]+);/gi, (match, hex) => String.fromCharCode(Number.parseInt(hex, 16)))

  return decodedText
}

// Aswak Assalam scraper implementation
const aswakAssalamScraper: WebsiteScraper = {
  name: "Aswak Assalam",
  baseUrl: "https://aswakassalam.com",
  urlPatterns: ["https://aswakassalam.com/ean1/{barcode}", "https://aswakassalam.com/ean2/{barcode}"],
  userAgents,

  isNotFoundPage(html: string): boolean {
    // Check for the specific 404 pattern provided by the user
    const entryTitlePattern = /<h2\s+class="entry-title">404\s+<i\s+class="fas\s+fa-file"><\/i><\/h2>/i
    if (entryTitlePattern.test(html)) {
      console.log("Found 404 page with entry-title pattern")
      return true
    }

    // Also check for the specific sorry message
    if (html.includes("We're sorry, but the page you were looking for doesn't exist.")) {
      console.log("Found 404 page with sorry message")
      return true
    }

    // Also check for section with page-not-found class
    if (html.includes('<section class="page-not-found">')) {
      console.log("Found 404 page with page-not-found section")
      return true
    }

    // Check for search page with no results
    if (html.includes("Vous avez cherché") && !html.includes("product-inner")) {
      console.log("Found search page with no results")
      return true
    }

    // Check for "Aucun résultat" (No results) text
    if (html.includes("Aucun résultat")) {
      console.log("Found 'Aucun résultat' text")
      return true
    }

    // Also check for other common 404 indicators
    const notFoundPatterns = [
      "404 - Page Not Found",
      "Erreur 404",
      "Page Not Found",
      "No products were found matching your selection",
    ]

    for (const pattern of notFoundPatterns) {
      if (html.includes(pattern)) {
        console.log(`Found 404 page with pattern: ${pattern}`)
        return true
      }
    }

    return false
  },

  extractProductInfo(html: string, barcode: string): ProductInfo {
    // Extract product name
    let name = `Product ${barcode}`

    // First try to find the product title in the main product section
    const productTitlePatterns = [
      /<h1[^>]*class="[^"]*product_title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i,
      /<h1[^>]*class="[^"]*entry-title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i,
      /<span[^>]*class="[^"]*product-title[^"]*"[^>]*>([\s\S]*?)<\/span>/i,
      /<div[^>]*class="[^"]*product_title[^>]*"*>([\s\S]*?)<\/div>/i,
      // The exact pattern from the user's HTML
      /<a[^>]*class="[^"]*product-loop-title[^"]*"[^>]*>\s*<h3[^>]*class="[^"]*woocommerce-loop-product__title[^"]*"[^>]*>([\s\S]*?)<\/h3>\s*<\/a>/i,
      // Try to get the title from the breadcrumb or page title
      /<title>(.*?)<\/title>/i,
    ]

    for (const pattern of productTitlePatterns) {
      const match = html.match(pattern)
      if (match && match[1]) {
        const extractedName = decodeHtmlEntities(match[1].replace(/<[^>]*>/g, "").trim())
        // Skip search page titles and 404 pages
        if (
          extractedName &&
          !extractedName.includes("Archives des") &&
          !extractedName.includes("404") &&
          !extractedName.includes("Vous avez cherché") &&
          !extractedName.includes("Aucun résultat")
        ) {
          name = extractedName
          break
        }
      }
    }

    // Extract price
    let price = "0.00"
    const pricePatterns = [
      /<span[^>]*class="[^"]*price[^"]*"[^>]*>([\s\S]*?)Dh<\/span>/i,
      /<span[^>]*class="[^"]*woocommerce-Price-amount[^"]*"[^>]*>([\s\S]*?)<\/span>/i,
      /<p[^>]*class="[^"]*price[^"]*"[^>]*>([\s\S]*?)<\/p>/i,
      /(\d+[,.]\d+)\s*Dh/i, // Generic price pattern
      /(\d+[,.]\d+)\s*DH/i, // Alternative format
    ]

    for (const pattern of pricePatterns) {
      const match = html.match(pattern)
      if (match && match[1]) {
        // Extract just the number from the price
        const priceText = match[1].replace(/<[^>]*>/g, "").trim()
        const priceNumber = priceText.match(/[\d,.]+/)
        if (priceNumber) {
          price = priceNumber[0]
          break
        }
      }
    }

    // Extract image URL
    let imageUrl = "https://aswakassalam.com/wp-content/uploads/2023/01/placeholder-300x300.png"
    const imagePatterns = [
      /<img[^>]*class="[^"]*wp-post-image[^"]*"[^>]*src="([^"]*)"[^>]*>/i,
      /<img[^>]*src="([^"]*)"[^>]*class="[^"]*wp-post-image[^"]*"[^>]*>/i,
      /<div[^>]*class="[^"]*woocommerce-product-gallery__image[^"]*"[^>]*>[\s\S]*?<img[^>]*src="([^"]*)"[^>]*>/i,
      /<img[^>]*src="([^"]*)"[^>]*>/i, // Generic image pattern
    ]

    for (const pattern of imagePatterns) {
      const match = html.match(pattern)
      if (match && match[1]) {
        imageUrl = match[1]
        break
      }
    }

    // Extract category
    let category = "Unknown"
    const categoryPatterns = [
      /<span[^>]*class="[^"]*posted_in[^"]*"[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i,
      /<a[^>]*rel="tag"[^>]*>([\s\S]*?)<\/a>/i,
      /Catégorie[^:]*:\s*([^<]+)/i, // Generic category pattern
      /CATÉGORIES\s*:\s*<[^>]*>([^<]+)/i, // Format seen in the screenshot
      /CATÉGORIES\s*:\s*([^<]+)/i, // Alternative format
    ]

    for (const pattern of categoryPatterns) {
      const match = html.match(pattern)
      if (match && match[1]) {
        category = decodeHtmlEntities(match[1].trim())
        break
      }
    }

    // Extract stock status
    let isInStock = true
    const stockPatterns = [
      /<p[^>]*class="[^"]*stock[^"]*"[^>]*>([\s\S]*?)<\/p>/i,
      /<span[^>]*class="[^"]*stock[^"]*"[^>]*>([\s\S]*?)<\/span>/i,
      /stock[^:]*:\s*([^<]+)/i, // Generic stock pattern
      /AVAILABILITY\s*:\s*([^<]+)/i, // Format seen in the screenshot
      /RUPTURE DE STOCK/i, // Out of stock indicator
    ]

    for (const pattern of stockPatterns) {
      const match = html.match(pattern)
      if (match && match[1]) {
        const stockStatus = match[1].toLowerCase()
        isInStock = !stockStatus.includes("rupture") && !stockStatus.includes("out of stock")
        break
      }
    }

    // Check for "RUPTURE DE STOCK" text anywhere in the HTML
    if (html.includes("RUPTURE DE STOCK")) {
      isInStock = false
    }

    console.log(`Extracted product info: Name=${name}, Price=${price}, Category=${category}, InStock=${isInStock}`)

    return {
      name,
      price,
      image: imageUrl,
      category,
      isInStock,
      source: "Aswak Assalam",
    }
  },
}

// Open Food Facts API implementation
async function fetchFromOpenFoodFacts(barcode: string): Promise<ProductInfo | null> {
  try {
    console.log(`Fetching from Open Food Facts API: ${barcode}`)
    const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`)

    if (!response.ok) {
      console.log(`Open Food Facts API returned status: ${response.status}`)
      return null
    }

    const data = await response.json()

    if (data.status !== 1 || !data.product) {
      console.log("Open Food Facts API: Product not found or invalid response")
      return null
    }

    // Extract the relevant information
    const product = data.product
    let name = product.product_name ? decodeHtmlEntities(product.product_name) : `Product ${barcode}`

    // Add quantity to the name if available
    if (product.quantity) {
      name = `${name} ${decodeHtmlEntities(product.quantity)}`
    }

    // Add brand to the name if available and not already part of the name
    if (product.brands && !name.includes(product.brands)) {
      name = `${name} - ${decodeHtmlEntities(product.brands)}`
    }

    return {
      name,
      price: "0.00", // Price not available from Open Food Facts
      image: product.image_url || "/placeholder.svg?height=200&width=200",
      category: product.categories ? decodeHtmlEntities(product.categories) : "Food",
      isInStock: true, // Stock information not available
      source: "Open Food Facts",
      quantity: product.quantity ? decodeHtmlEntities(product.quantity) : "",
    }
  } catch (error) {
    console.error("Error fetching from Open Food Facts:", error)
    return null
  }
}

// Function to fetch product from a specific website
async function fetchProductFromWebsite(scraper: WebsiteScraper, barcode: string): Promise<ProductInfo | null> {
  let productData: ProductInfo | null = null
  let responseStatus = null
  let responseUrl = null
  let notFoundCount = 0

  // Try each URL pattern with different user agents
  for (const urlPattern of scraper.urlPatterns) {
    const url = urlPattern.replace("{barcode}", barcode)

    for (const userAgent of scraper.userAgents) {
      try {
        console.log(`[${scraper.name}] Trying URL: ${url} with User-Agent: ${userAgent.substring(0, 20)}...`)

        const response = await fetch(url, {
          headers: {
            "User-Agent": userAgent,
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            Connection: "keep-alive",
            "Upgrade-Insecure-Requests": "1",
            "Cache-Control": "max-age=0",
          },
        })

        responseStatus = response.status
        responseUrl = response.url

        console.log(`[${scraper.name}] Response status: ${responseStatus}, URL: ${responseUrl}`)

        // Count 404 responses
        if (responseStatus === 404) {
          notFoundCount++
          continue
        }

        if (!response.ok) continue

        const html = await response.text()

        // Check if the page is a 404 page
        if (scraper.isNotFoundPage(html)) {
          console.log(`[${scraper.name}] Found 404 page at ${url}`)
          notFoundCount++
          continue
        }

        // Log a portion of the HTML for debugging
        console.log(`[${scraper.name}] HTML snippet from ${url} (${html.length} bytes):`, html.substring(0, 500))

        // Extract product information using the scraper's method
        const productInfo = scraper.extractProductInfo(html, barcode)
        if (productInfo.name && productInfo.name !== `Product ${barcode}` && !productInfo.notFound) {
          productData = productInfo
          break
        }
      } catch (error) {
        console.error(
          `[${scraper.name}] Error fetching from ${url} with user agent ${userAgent.substring(0, 20)}:`,
          error,
        )
      }
    }

    if (productData) break
  }

  // If we got multiple 404 responses or detected 404 pages, the product is likely not available
  if (notFoundCount >= 1 && !productData) {
    console.log(`[${scraper.name}] Product not found: notFoundCount=${notFoundCount}`)
    return null
  }

  return productData
}

// Array of all available scrapers
const scrapers: WebsiteScraper[] = [aswakAssalamScraper]

// Make sure to export the GET function as a named export
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const barcode = searchParams.get("barcode")
  const websiteParam = searchParams.get("website") // Optional parameter to specify which website to use

  if (!barcode) {
    return NextResponse.json({ error: "Barcode is required" }, { status: 400 })
  }

  try {
    let productData: ProductInfo | null = null
    const allResults: ProductInfo[] = []

    // If a specific website is requested, only try that one
    if (websiteParam) {
      const scraper = scrapers.find((s) => s.name.toLowerCase() === websiteParam.toLowerCase())
      if (!scraper) {
        return NextResponse.json(
          {
            error: "Invalid website parameter",
            availableWebsites: scrapers.map((s) => s.name),
          },
          { status: 400 },
        )
      }

      productData = await fetchProductFromWebsite(scraper, barcode)
      if (productData) {
        allResults.push(productData)
      }
    } else {
      // Try all scrapers in order
      for (const scraper of scrapers) {
        console.log(`Trying to fetch product from ${scraper.name}...`)
        const result = await fetchProductFromWebsite(scraper, barcode)
        if (result) {
          allResults.push(result)
          if (!productData) {
            productData = result // Use the first successful result as the primary one
          }
        }
      }

      // If no product found in scrapers, try Open Food Facts API
      if (!productData) {
        console.log("No product found in scrapers, trying Open Food Facts API...")
        const openFoodFactsResult = await fetchFromOpenFoodFacts(barcode)
        if (openFoodFactsResult) {
          allResults.push(openFoodFactsResult)
          productData = openFoodFactsResult
        }
      }
    }

    if (productData) {
      return NextResponse.json({
        ...productData,
        barcode,
        allResults: allResults.length > 1 ? allResults : undefined, // Include all results if we have more than one
      })
    }

    // If we couldn't find the product on any website, return a clear message
    return NextResponse.json(
      {
        error: "Product not found",
        message: "This product is not available in any of our supported websites.",
        notAvailable: true,
        barcode,
        searchedWebsites: websiteParam ? [websiteParam] : [...scrapers.map((s) => s.name), "Open Food Facts"],
      },
      { status: 404 },
    )
  } catch (error) {
    console.error("Error fetching product:", error)

    return NextResponse.json({
      error: "Failed to fetch product",
      message: "Error connecting to product websites.",
      mockData: true,
      name: `Product ${barcode.substring(0, 4)}`,
      price: (Math.random() * 100).toFixed(2),
      image: "/placeholder.svg?height=200&width=200",
      category: "Mock Category",
      isInStock: true,
      barcode,
    })
  }
}

