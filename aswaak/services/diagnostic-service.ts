import { supabase, isSupabaseInitialized, testSupabaseConnection } from "@/lib/supabase"
import { fetchCategories } from "@/services/category-service"

export interface HealthCheckResult {
  name: string
  status: "healthy" | "degraded" | "error"
  message: string
  timestamp: string
  responseTime?: number
}

export interface SystemStatus {
  overall: "healthy" | "degraded" | "error"
  checks: HealthCheckResult[]
  lastUpdated: string
}

// Function to check if a URL is reachable
export async function checkEndpoint(url: string, timeout = 5000): Promise<HealthCheckResult> {
  const startTime = performance.now()
  const name = url.includes("aswakassalam")
    ? "Aswak Assalam API"
    : url.includes("openfoodfacts")
      ? "Open Food Facts API"
      : "External API"

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    const response = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      // Use no-cors mode for external domains
      mode: "no-cors",
    })

    clearTimeout(timeoutId)
    const responseTime = performance.now() - startTime

    return {
      name,
      status: "healthy",
      message: "Endpoint is reachable",
      timestamp: new Date().toISOString(),
      responseTime: Math.round(responseTime),
    }
  } catch (error) {
    const responseTime = performance.now() - startTime
    console.error(`Error checking endpoint ${url}:`, error)

    return {
      name,
      status: "error",
      message: error instanceof Error ? error.message : "Failed to reach endpoint",
      timestamp: new Date().toISOString(),
      responseTime: Math.round(responseTime),
    }
  }
}

// Function to check database connection
export async function checkDatabaseConnection(): Promise<HealthCheckResult> {
  const startTime = performance.now()

  try {
    if (!isSupabaseInitialized()) {
      return {
        name: "Database Connection",
        status: "error",
        message: "Supabase client not initialized",
        timestamp: new Date().toISOString(),
        responseTime: Math.round(performance.now() - startTime),
      }
    }

    const result = await testSupabaseConnection()
    const responseTime = performance.now() - startTime

    return {
      name: "Database Connection",
      status: result.success ? "healthy" : "error",
      message: result.message,
      timestamp: new Date().toISOString(),
      responseTime: Math.round(responseTime),
    }
  } catch (error) {
    const responseTime = performance.now() - startTime

    return {
      name: "Database Connection",
      status: "error",
      message: error instanceof Error ? error.message : "Unknown database error",
      timestamp: new Date().toISOString(),
      responseTime: Math.round(responseTime),
    }
  }
}

// Function to check if categories can be loaded
export async function checkCategoriesLoading(): Promise<HealthCheckResult> {
  const startTime = performance.now()

  try {
    const categories = await fetchCategories()
    const responseTime = performance.now() - startTime

    return {
      name: "Categories Loading",
      status: categories.length > 0 ? "healthy" : "degraded",
      message: categories.length > 0 ? `Successfully loaded ${categories.length} categories` : "No categories found",
      timestamp: new Date().toISOString(),
      responseTime: Math.round(responseTime),
    }
  } catch (error) {
    const responseTime = performance.now() - startTime

    return {
      name: "Categories Loading",
      status: "error",
      message: error instanceof Error ? error.message : "Failed to load categories",
      timestamp: new Date().toISOString(),
      responseTime: Math.round(responseTime),
    }
  }
}

// Function to check if the API route is working
export async function checkApiRoute(): Promise<HealthCheckResult> {
  const startTime = performance.now()

  try {
    // Use a test barcode that should return a 404 - we just want to check if the API route itself works
    const response = await fetch(`/api/fetch-product?barcode=test-barcode-123`)
    const responseTime = performance.now() - startTime

    // Even a 404 is fine - it means the API route is working
    return {
      name: "Product API Route",
      status: response.status === 404 ? "healthy" : response.ok ? "healthy" : "degraded",
      message:
        response.status === 404
          ? "API route is working (expected 404 for test barcode)"
          : response.ok
            ? "API route is working"
            : `API route returned status ${response.status}`,
      timestamp: new Date().toISOString(),
      responseTime: Math.round(responseTime),
    }
  } catch (error) {
    const responseTime = performance.now() - startTime

    return {
      name: "Product API Route",
      status: "error",
      message: error instanceof Error ? error.message : "Failed to call API route",
      timestamp: new Date().toISOString(),
      responseTime: Math.round(responseTime),
    }
  }
}

// Function to check local storage
export async function checkLocalStorage(): Promise<HealthCheckResult> {
  try {
    // Try to write and read from localStorage
    const testKey = `test-${Date.now()}`
    localStorage.setItem(testKey, "test")
    const value = localStorage.getItem(testKey)
    localStorage.removeItem(testKey)

    return {
      name: "Local Storage",
      status: value === "test" ? "healthy" : "degraded",
      message: value === "test" ? "Local storage is working" : "Local storage read/write test failed",
      timestamp: new Date().toISOString(),
    }
  } catch (error) {
    return {
      name: "Local Storage",
      status: "error",
      message: error instanceof Error ? error.message : "Local storage is not available",
      timestamp: new Date().toISOString(),
    }
  }
}

// Function to run all health checks
export async function runAllHealthChecks(): Promise<SystemStatus> {
  const checks: HealthCheckResult[] = []

  // Run all checks in parallel
  const results = await Promise.all([
    checkDatabaseConnection(),
    checkCategoriesLoading(),
    checkApiRoute(),
    checkLocalStorage(),
    checkEndpoint("https://aswakassalam.com"),
    checkEndpoint("https://world.openfoodfacts.org"),
  ])

  checks.push(...results)

  // Determine overall status
  const hasErrors = checks.some((check) => check.status === "error")
  const hasDegraded = checks.some((check) => check.status === "degraded")

  const overall = hasErrors ? "error" : hasDegraded ? "degraded" : "healthy"

  return {
    overall,
    checks,
    lastUpdated: new Date().toISOString(),
  }
}

// Function to test a specific barcode
export async function testBarcode(barcode: string): Promise<{
  success: boolean
  message: string
  data?: any
  source?: string
}> {
  try {
    // First check if it exists in the database
    if (isSupabaseInitialized()) {
      const { data, error } = await supabase.from("products").select("*").eq("barcode", barcode).single()

      if (!error && data) {
        return {
          success: true,
          message: "Product found in database",
          data,
          source: "database",
        }
      }
    }

    // If not in database, try the API
    const response = await fetch(`/api/fetch-product?barcode=${barcode}`)
    const result = await response.json()

    if (response.ok) {
      return {
        success: true,
        message: "Product found via API",
        data: result,
        source: result.source || "api",
      }
    } else {
      return {
        success: false,
        message: result.message || `API returned status ${response.status}`,
        data: result,
      }
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error testing barcode",
    }
  }
}

