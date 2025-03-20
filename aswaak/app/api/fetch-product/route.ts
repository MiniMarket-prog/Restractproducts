import { NextResponse } from "next/server"

// Hardcoded product data for known barcodes
type KnownProduct = {
  name: string
  price: string
  image: string
  category: string
  isInStock: boolean
}

// Define a type for product info that includes the optional notFound property
type ProductInfo = {
  name: string
  price: string
  image: string
  category: string
  isInStock: boolean
  notFound?: boolean
}

// Different user agents to try
const userAgents = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36",
]

// Function to decode HTML entities
function decodeHtmlEntities(text: string): string {
  const entities: Record<string, string> = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#039;": "'",
    "&#038;": "&",
    "&nbsp;": " ",
  }

  // Replace named entities
  let decodedText = text.replace(/&amp;|&lt;|&gt;|&quot;|&#039;|&#038;|&nbsp;/g, (match) => entities[match])

  // Replace numeric entities
  decodedText = decodedText.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))

  return decodedText
}

// Function to check if HTML contains a 404 page or empty search results
function isNotFoundPage(html: string): boolean {
  // Check for the specific 404 pattern provided by the user
  // Using a more flexible regex pattern to match the h2 with entry-title class containing "404"
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
}

// Make sure to export the GET function as a named export
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const barcode = searchParams.get("barcode")

  if (!barcode) {
    return NextResponse.json({ error: "Barcode is required" }, { status: 400 })
  }

  try {
    // Try different URL formats
    const urls = [
      `https://aswakassalam.com/ean1/${barcode}`,
      `https://aswakassalam.com/produit/${barcode}`,
      `https://aswakassalam.com/?s=${barcode}&post_type=product`,
    ]

    let productData: ProductInfo | null = null
    let responseStatus = null
    let responseUrl = null
    let notFoundCount = 0

    // Try each URL with different user agents
    for (const url of urls) {
      for (const userAgent of userAgents) {
        try {
          console.log(`Trying URL: ${url} with User-Agent: ${userAgent.substring(0, 20)}...`)

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

          console.log(`Response status: ${responseStatus}, URL: ${responseUrl}`)

          // Count 404 responses
          if (responseStatus === 404) {
            notFoundCount++
            continue
          }

          if (!response.ok) continue

          const html = await response.text()

          // Add more detailed logging for 404 detection
          console.log(`Checking for 404 page at ${url}...`)
          if (html.includes('<h2 class="entry-title">404')) {
            console.log("Found '<h2 class=\"entry-title\">404' in HTML")
          }
          if (html.includes("We're sorry, but the page you were looking for doesn't exist.")) {
            console.log("Found 'We're sorry, but the page you were looking for doesn't exist.' in HTML")
          }

          // Check if the page is a 404 page using our new function
          if (isNotFoundPage(html)) {
            console.log(`Found 404 page at ${url}`)
            notFoundCount++
            continue
          }

          // Log a portion of the HTML for debugging
          console.log(`HTML snippet from ${url} (${html.length} bytes):`, html.substring(0, 500))

          // Check if this is a product page or search results page
          if (html.includes("product-type-") || html.includes("woocommerce-product-gallery")) {
            // Extract product information from product page
            const productInfo = extractProductInfo(html, barcode)
            if (productInfo.name && productInfo.name !== `Product ${barcode}` && !productInfo.notFound) {
              productData = productInfo
              break
            }
          } else if (
            html.includes("products-container") ||
            html.includes("product-inner") ||
            html.includes("product-loop-title")
          ) {
            // Extract product information from search results page
            const productInfo = extractProductFromSearchResults(html, barcode)
            if (productInfo.name && productInfo.name !== `Product ${barcode}` && !productInfo.notFound) {
              productData = productInfo
              break
            }
          }
        } catch (error) {
          console.error(`Error fetching from ${url} with user agent ${userAgent.substring(0, 20)}:`, error)
        }
      }

      if (productData) break
    }

    // If we got multiple 404 responses or detected 404 pages, the product is likely not available
    if (notFoundCount >= 1 && !productData) {
      console.log(`Product not found: notFoundCount=${notFoundCount}`)
      return NextResponse.json(
        {
          error: "Product not found",
          message: "This product is not available in Aswak Assalam.",
          notAvailable: true,
          barcode,
        },
        { status: 404 },
      )
    }

    if (productData) {
      return NextResponse.json({
        ...productData,
        barcode,
      })
    }

    // If we couldn't find the product, return a clear message
    return NextResponse.json(
      {
        error: "Product not found",
        message: "This product is not available in Aswak Assalam.",
        notAvailable: true,
        barcode,
        debug: {
          lastResponseStatus: responseStatus,
          lastResponseUrl: responseUrl,
          triedUrls: urls,
        },
      },
      { status: 404 },
    )
  } catch (error) {
    console.error("Error fetching product:", error)

    return NextResponse.json({
      error: "Failed to fetch product",
      message: "Error connecting to Aswak Assalam.",
      mockData: true,
      name: `Product ${barcode.substring(0, 4)}`,
      price: (Math.random() * 100).toFixed(2),
      image: "https://aswakassalam.com/wp-content/uploads/2023/01/placeholder-300x300.png",
      category: "Mock Category",
      isInStock: true,
      barcode,
    })
  }
}

function extractProductInfo(html: string, barcode: string): ProductInfo {
  // Extract product name
  let name = `Product ${barcode}`

  // First try to find the product title in the main product section
  const productTitlePatterns = [
    /<h1[^>]*class="[^"]*product_title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i,
    /<h1[^>]*class="[^"]*entry-title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i,
    /<span[^>]*class="[^"]*product-title[^"]*"[^>]*>([\s\S]*?)<\/span>/i,
    /<div[^>]*class="[^"]*product_title[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
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
  }
}

function extractProductFromSearchResults(html: string, barcode: string): ProductInfo {
  // Check if this is a search page with no results
  if (html.includes("Vous avez cherché") && !html.includes("product-inner")) {
    console.log("Search page has no results")
    return {
      name: `Product ${barcode}`,
      price: "0.00",
      image: "https://aswakassalam.com/wp-content/uploads/2023/01/placeholder-300x300.png",
      category: "Unknown",
      isInStock: true,
      notFound: true, // Add a flag to indicate this is not a valid product
    }
  }

  // Find the first product in search results
  const productBlockPattern = /<div[^>]*class="[^"]*product-inner[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/i
  const productBlock = html.match(productBlockPattern)

  if (!productBlock) {
    // Try alternative patterns for product blocks
    const altProductBlockPattern = /<li[^>]*class="[^"]*product[^"]*"[^>]*>([\s\S]*?)<\/li>/i
    const altProductBlock = html.match(altProductBlockPattern)

    if (!altProductBlock) {
      return {
        name: `Product ${barcode}`,
        price: "0.00",
        image: "https://aswakassalam.com/wp-content/uploads/2023/01/placeholder-300x300.png",
        category: "Unknown",
        isInStock: true,
        notFound: true, // Add a flag to indicate this is not a valid product
      }
    }

    const productHtml = altProductBlock[0]
    return extractFromProductHtml(productHtml, barcode)
  }

  const productHtml = productBlock[0]
  return extractFromProductHtml(productHtml, barcode)
}

function extractFromProductHtml(productHtml: string, barcode: string): ProductInfo {
  // Extract product name
  let name = `Product ${barcode}`

  // Add the exact pattern the user found through inspection
  const exactTitlePatterns = [
    /<a[^>]*class="[^"]*product-loop-title[^"]*"[^>]*>\s*<h3[^>]*class="[^"]*woocommerce-loop-product__title[^"]*"[^>]*>([\s\S]*?)<\/h3>\s*<\/a>/i,
    /<a[^>]*class="[^"]*product-loop-title[^"]*"[^>]*>\s*<h3[^>]*>([\s\S]*?)<\/h3>\s*<\/a>/i,
  ]

  for (const pattern of exactTitlePatterns) {
    const exactMatch = productHtml.match(pattern)
    if (exactMatch && exactMatch[1]) {
      name = decodeHtmlEntities(exactMatch[1].replace(/<[^>]*>/g, "").trim())
      if (name) break
    }
  }

  // If we still don't have a name, try other patterns
  if (name === `Product ${barcode}`) {
    const namePatterns = [
      /<h2[^>]*class="[^"]*woocommerce-loop-product__title[^"]*"[^>]*>([\s\S]*?)<\/h2>/i,
      /<h3[^>]*class="[^"]*woocommerce-loop-product__title[^"]*"[^>]*>([\s\S]*?)<\/h3>/i,
      /<h3[^>]*>([\s\S]*?)<\/h3>/i,
      /<a[^>]*class="[^"]*product-loop-title[^"]*"[^>]*>([\s\S]*?)<\/a>/i,
    ]

    for (const pattern of namePatterns) {
      const nameMatch = productHtml.match(pattern)
      if (nameMatch && nameMatch[1]) {
        name = decodeHtmlEntities(nameMatch[1].replace(/<[^>]*>/g, "").trim())
        if (name) break
      }
    }
  }

  // Extract price
  let price = "0.00"
  const pricePatterns = [
    /<span[^>]*class="[^"]*price[^"]*"[^>]*>([\s\S]*?)<\/span>/i,
    /<span[^>]*class="[^"]*woocommerce-Price-amount[^"]*"[^>]*>([\s\S]*?)<\/span>/i,
    /(\d+[,.]\d+)\s*Dh/i,
  ]

  for (const pattern of pricePatterns) {
    const priceMatch = productHtml.match(pattern)
    if (priceMatch && priceMatch[1]) {
      const priceText = priceMatch[1].replace(/<[^>]*>/g, "").trim()
      const priceNumber = priceText.match(/[\d,.]+/)
      if (priceNumber) {
        price = priceNumber[0]
        break
      }
    }
  }

  // Extract image URL
  let imageUrl = "https://aswakassalam.com/wp-content/uploads/2023/01/placeholder-300x300.png"
  const imagePattern = /<img[^>]*src="([^"]*)"[^>]*>/i
  const imageMatch = productHtml.match(imagePattern)

  if (imageMatch && imageMatch[1]) {
    imageUrl = imageMatch[1]
  }

  // Extract category (may not be available in search results)
  const category = "Unknown"

  // Check for stock status
  let isInStock = true
  if (productHtml.includes("RUPTURE DE STOCK") || productHtml.toLowerCase().includes("out of stock")) {
    isInStock = false
  }

  console.log(`Extracted from product HTML: Name=${name}, Price=${price}, InStock=${isInStock}`)

  return {
    name,
    price,
    image: imageUrl,
    category,
    isInStock,
  }
}

