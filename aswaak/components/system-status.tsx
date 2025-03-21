"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Clock,
  Database,
  Globe,
  Server,
  Barcode,
  Search,
  Loader2,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import {
  runAllHealthChecks,
  testBarcode,
  type SystemStatus,
  type HealthCheckResult,
} from "@/services/diagnostic-service"

export function SystemStatusDashboard() {
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [testBarcodeValue, setTestBarcodeValue] = useState("")
  const [testBarcodeResult, setTestBarcodeResult] = useState<any>(null)
  const [isTesting, setIsTesting] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    checkSystemStatus()
  }, [])

  const checkSystemStatus = async () => {
    setIsLoading(true)
    try {
      const status = await runAllHealthChecks()
      setSystemStatus(status)
    } catch (error) {
      console.error("Error checking system status:", error)
      toast({
        title: "Error",
        description: "Failed to check system status",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleTestBarcode = async () => {
    if (!testBarcodeValue.trim()) {
      toast({
        title: "Error",
        description: "Please enter a barcode to test",
        variant: "destructive",
      })
      return
    }

    setIsTesting(true)
    setTestBarcodeResult(null)

    try {
      const result = await testBarcode(testBarcodeValue.trim())
      setTestBarcodeResult(result)
    } catch (error) {
      console.error("Error testing barcode:", error)
      toast({
        title: "Error",
        description: "Failed to test barcode",
        variant: "destructive",
      })
    } finally {
      setIsTesting(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "healthy":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />
      case "degraded":
        return <AlertTriangle className="h-5 w-5 text-amber-500" />
      case "error":
        return <XCircle className="h-5 w-5 text-red-500" />
      default:
        return null
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "healthy":
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            Healthy
          </Badge>
        )
      case "degraded":
        return (
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
            Degraded
          </Badge>
        )
      case "error":
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
            Error
          </Badge>
        )
      default:
        return null
    }
  }

  const getServiceIcon = (name: string) => {
    if (name.includes("Database")) return <Database className="h-4 w-4" />
    if (name.includes("API")) return <Server className="h-4 w-4" />
    if (name.includes("Food Facts")) return <Globe className="h-4 w-4" />
    if (name.includes("Aswak")) return <Globe className="h-4 w-4" />
    if (name.includes("Categories")) return <Database className="h-4 w-4" />
    if (name.includes("Storage")) return <Database className="h-4 w-4" />
    return <Server className="h-4 w-4" />
  }

  const formatTime = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleTimeString()
    } catch (e) {
      return "Unknown"
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">System Status</h2>
          <p className="text-muted-foreground">Check the health of your application components</p>
        </div>
        <Button onClick={checkSystemStatus} disabled={isLoading} variant="outline">
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Checking...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh Status
            </>
          )}
        </Button>
      </div>

      <Tabs defaultValue="status">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="status">System Status</TabsTrigger>
          <TabsTrigger value="test">Test Barcode</TabsTrigger>
          <TabsTrigger value="info">System Info</TabsTrigger>
        </TabsList>

        <TabsContent value="status" className="space-y-4 mt-4">
          {systemStatus ? (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-center">
                    <CardTitle>Overall Status</CardTitle>
                    {getStatusBadge(systemStatus.overall)}
                  </div>
                  <CardDescription>Last updated: {formatTime(systemStatus.lastUpdated)}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {systemStatus.checks.map((check: HealthCheckResult) => (
                      <div key={check.name} className="flex items-center justify-between p-2 border rounded-md">
                        <div className="flex items-center gap-2">
                          {getServiceIcon(check.name)}
                          <div>
                            <p className="font-medium">{check.name}</p>
                            <p className="text-sm text-muted-foreground">{check.message}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {check.responseTime && (
                            <span className="text-xs text-muted-foreground flex items-center">
                              <Clock className="h-3 w-3 mr-1" />
                              {check.responseTime}ms
                            </span>
                          )}
                          {getStatusIcon(check.status)}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
                <CardFooter className="text-xs text-muted-foreground">
                  <Clock className="h-3 w-3 mr-1" /> Last check: {formatTime(systemStatus.lastUpdated)}
                </CardFooter>
              </Card>
            </>
          ) : (
            <div className="flex justify-center items-center p-8">
              {isLoading ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p>Checking system status...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <AlertTriangle className="h-8 w-8 text-muted-foreground" />
                  <p>No status information available</p>
                  <Button onClick={checkSystemStatus} variant="outline" size="sm">
                    Check Now
                  </Button>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="test" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Test Barcode</CardTitle>
              <CardDescription>Test if a barcode can be found in the database or via the API</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 mb-4">
                <div className="flex-1">
                  <Input
                    placeholder="Enter barcode to test"
                    value={testBarcodeValue}
                    onChange={(e) => setTestBarcodeValue(e.target.value)}
                  />
                </div>
                <Button onClick={handleTestBarcode} disabled={isTesting}>
                  {isTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                  Test
                </Button>
              </div>

              {testBarcodeResult && (
                <div className="mt-4">
                  <Alert variant={testBarcodeResult.success ? "default" : "destructive"}>
                    <div className="flex items-center gap-2">
                      {testBarcodeResult.success ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <XCircle className="h-4 w-4" />
                      )}
                      <AlertTitle>{testBarcodeResult.success ? "Success" : "Not Found"}</AlertTitle>
                    </div>
                    <AlertDescription className="mt-2">
                      {testBarcodeResult.message}
                      {testBarcodeResult.source && (
                        <Badge variant="outline" className="ml-2">
                          {testBarcodeResult.source}
                        </Badge>
                      )}
                    </AlertDescription>
                  </Alert>

                  {testBarcodeResult.data && (
                    <div className="mt-4 p-3 bg-muted rounded-md">
                      <p className="font-medium mb-2">Product Data:</p>
                      <pre className="text-xs overflow-auto max-h-40 p-2 bg-background rounded">
                        {JSON.stringify(testBarcodeResult.data, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-6">
                <h3 className="font-medium mb-2">Sample Barcodes to Try:</h3>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="justify-start"
                    onClick={() => setTestBarcodeValue("6111245591063")}
                  >
                    <Barcode className="h-3 w-3 mr-2" />
                    6111245591063
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="justify-start"
                    onClick={() => setTestBarcodeValue("5449000318947")}
                  >
                    <Barcode className="h-3 w-3 mr-2" />
                    5449000318947
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="justify-start"
                    onClick={() => setTestBarcodeValue("3017620422003")}
                  >
                    <Barcode className="h-3 w-3 mr-2" />
                    3017620422003
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="justify-start"
                    onClick={() => setTestBarcodeValue("8000500310427")}
                  >
                    <Barcode className="h-3 w-3 mr-2" />
                    8000500310427
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="info" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>System Information</CardTitle>
              <CardDescription>Details about your application environment</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium mb-2">Environment Variables:</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="p-2 bg-muted rounded-md">
                      <p className="font-medium">NEXT_PUBLIC_SUPABASE_URL</p>
                      <p className="text-muted-foreground">
                        {process.env.NEXT_PUBLIC_SUPABASE_URL ? "Set" : "Not set"}
                      </p>
                    </div>
                    <div className="p-2 bg-muted rounded-md">
                      <p className="font-medium">NEXT_PUBLIC_SUPABASE_ANON_KEY</p>
                      <p className="text-muted-foreground">
                        {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
                          ? `Set (starts with ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.substring(0, 3)}...)`
                          : "Not set"}
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-medium mb-2">Browser Information:</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="p-2 bg-muted rounded-md">
                      <p className="font-medium">User Agent</p>
                      <p className="text-muted-foreground truncate">{navigator.userAgent}</p>
                    </div>
                    <div className="p-2 bg-muted rounded-md">
                      <p className="font-medium">Platform</p>
                      <p className="text-muted-foreground">{navigator.platform}</p>
                    </div>
                    <div className="p-2 bg-muted rounded-md">
                      <p className="font-medium">Screen Size</p>
                      <p className="text-muted-foreground">
                        {window.innerWidth}x{window.innerHeight}
                      </p>
                    </div>
                    <div className="p-2 bg-muted rounded-md">
                      <p className="font-medium">Language</p>
                      <p className="text-muted-foreground">{navigator.language}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-medium mb-2">API Endpoints:</h3>
                  <div className="space-y-2 text-sm">
                    <div className="p-2 bg-muted rounded-md">
                      <p className="font-medium">Product API</p>
                      <p className="text-muted-foreground">/api/fetch-product?barcode=[barcode]</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

