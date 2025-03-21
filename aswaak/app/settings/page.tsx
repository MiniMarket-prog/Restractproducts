"use client"

import { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { useToast } from "@/hooks/use-toast"
import { CategoryManagement } from "@/components/category-management"
import { Save, RotateCcw, AlertTriangle, Loader2 } from "lucide-react"
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
import { fetchCategories } from "@/services/category-service"
import type { Category } from "@/types/product"

// Define the settings interface
interface AppSettings {
  display: {
    showImages: boolean
    defaultView: "compact" | "detailed"
    historyItemsPerPage: number
    theme: "light" | "dark" | "system"
  }
  inventory: {
    lowStockThreshold: number
    enableStockAlerts: boolean
    defaultMinStock: number
    defaultStock: number
    priceFormat: "fixed" | "percentage"
    defaultSellingPrice: string
    defaultPurchasePrice: string
    defaultMargin: number
    defaultCategoryId: string
  }
  scanning: {
    autoSave: boolean
    preferredScanner: "camera" | "manual" | "demo"
    autoDetect: boolean
    beepOnScan: boolean
  }
  advanced: {
    debugMode: boolean
    keepHistoryDays: number
    maxHistoryItems: number
  }
}

// Default settings
const defaultSettings: AppSettings = {
  display: {
    showImages: true,
    defaultView: "detailed",
    historyItemsPerPage: 10,
    theme: "system",
  },
  inventory: {
    lowStockThreshold: 25, // percentage
    enableStockAlerts: true,
    defaultMinStock: 5,
    defaultStock: 10,
    priceFormat: "fixed",
    defaultSellingPrice: "20",
    defaultPurchasePrice: "10",
    defaultMargin: 20,
    defaultCategoryId: "",
  },
  scanning: {
    autoSave: false,
    preferredScanner: "camera",
    autoDetect: true,
    beepOnScan: true,
  },
  advanced: {
    debugMode: false,
    keepHistoryDays: 30,
    maxHistoryItems: 100,
  },
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings)
  const [hasChanges, setHasChanges] = useState(false)
  const [showResetDialog, setShowResetDialog] = useState(false)
  const { toast } = useToast()
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoadingCategories, setIsLoadingCategories] = useState(false)

  // Load settings from localStorage on component mount
  useEffect(() => {
    const savedSettings = localStorage.getItem("appSettings")
    if (savedSettings) {
      try {
        const parsedSettings = JSON.parse(savedSettings)
        setSettings(parsedSettings)
      } catch (error) {
        console.error("Error parsing saved settings:", error)
        // If there's an error, use default settings
        setSettings(defaultSettings)
      }
    }

    // Load categories
    loadCategories()
  }, [])

  // Load categories for the default category selector
  const loadCategories = async () => {
    setIsLoadingCategories(true)
    try {
      const categoriesData = await fetchCategories()
      setCategories(categoriesData)
    } catch (error) {
      console.error("Error loading categories:", error)
      toast({
        title: "Error",
        description: "Failed to load categories",
        variant: "destructive",
      })
    } finally {
      setIsLoadingCategories(false)
    }
  }

  // Update a specific setting
  const updateSetting = <T extends keyof AppSettings, K extends keyof AppSettings[T]>(
    category: T,
    key: K,
    value: AppSettings[T][K],
  ) => {
    setSettings((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: value,
      },
    }))
    setHasChanges(true)
  }

  // Save settings to localStorage
  const saveSettings = () => {
    localStorage.setItem("appSettings", JSON.stringify(settings))
    setHasChanges(false)
    toast({
      title: "Settings saved",
      description: "Your settings have been saved successfully.",
    })
  }

  // Reset settings to defaults
  const resetSettings = () => {
    setSettings(defaultSettings)
    setHasChanges(true)
    setShowResetDialog(false)
    toast({
      title: "Settings reset",
      description: "All settings have been reset to default values.",
    })
  }

  return (
    <div className="container py-6 max-w-4xl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Customize your application preferences</p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowResetDialog(true)}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset to Defaults
          </Button>
          <Button onClick={saveSettings} disabled={!hasChanges}>
            <Save className="h-4 w-4 mr-2" />
            Save Changes
          </Button>
        </div>
      </div>

      <Tabs defaultValue="display">
        <TabsList className="grid grid-cols-4 mb-6">
          <TabsTrigger value="display">Display</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="scanning">Scanning</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>

        {/* Display Settings */}
        <TabsContent value="display">
          <Card>
            <CardHeader>
              <CardTitle>Display Settings</CardTitle>
              <CardDescription>Customize how products and information are displayed in the app</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="show-images" className="flex flex-col">
                    <span>Show Product Images</span>
                    <span className="text-sm text-muted-foreground">Display product images when available</span>
                  </Label>
                  <Switch
                    id="show-images"
                    checked={settings.display.showImages}
                    onCheckedChange={(checked: boolean) => updateSetting("display", "showImages", checked)}
                  />
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="default-view">Default Product View</Label>
                  <Select
                    value={settings.display.defaultView}
                    onValueChange={(value: string) =>
                      updateSetting("display", "defaultView", value as "compact" | "detailed")
                    }
                  >
                    <SelectTrigger id="default-view">
                      <SelectValue placeholder="Select view style" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="compact">Compact</SelectItem>
                      <SelectItem value="detailed">Detailed</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">Choose how products are displayed by default</p>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="history-items">History Items Per Page</Label>
                  <div className="flex items-center gap-4">
                    <Slider
                      id="history-items"
                      min={5}
                      max={50}
                      step={5}
                      value={[settings.display.historyItemsPerPage]}
                      onValueChange={(value: number[]) => updateSetting("display", "historyItemsPerPage", value[0])}
                      className="flex-1"
                    />
                    <span className="w-12 text-center">{settings.display.historyItemsPerPage}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Number of items to display per page in history view</p>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="theme">Theme</Label>
                  <Select
                    value={settings.display.theme}
                    onValueChange={(value: string) =>
                      updateSetting("display", "theme", value as "light" | "dark" | "system")
                    }
                  >
                    <SelectTrigger id="theme">
                      <SelectValue placeholder="Select theme" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="dark">Dark</SelectItem>
                      <SelectItem value="system">System</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">Choose your preferred theme</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Inventory Settings */}
        <TabsContent value="inventory">
          <Card>
            <CardHeader>
              <CardTitle>Inventory Settings</CardTitle>
              <CardDescription>Configure stock management and inventory preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="low-stock-threshold">Low Stock Threshold (%)</Label>
                  <div className="flex items-center gap-4">
                    <Slider
                      id="low-stock-threshold"
                      min={5}
                      max={50}
                      step={5}
                      value={[settings.inventory.lowStockThreshold]}
                      onValueChange={(value: number[]) => updateSetting("inventory", "lowStockThreshold", value[0])}
                      className="flex-1"
                    />
                    <span className="w-12 text-center">{settings.inventory.lowStockThreshold}%</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Products will be marked as "low stock" when stock falls below this percentage of minimum stock
                  </p>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <Label htmlFor="stock-alerts" className="flex flex-col">
                    <span>Enable Stock Alerts</span>
                    <span className="text-sm text-muted-foreground">Show notifications for low stock items</span>
                  </Label>
                  <Switch
                    id="stock-alerts"
                    checked={settings.inventory.enableStockAlerts}
                    onCheckedChange={(checked: boolean) => updateSetting("inventory", "enableStockAlerts", checked)}
                  />
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="default-min-stock">Default Minimum Stock</Label>
                  <div className="flex items-center gap-4">
                    <Input
                      id="default-min-stock"
                      type="number"
                      min={0}
                      value={settings.inventory.defaultMinStock}
                      onChange={(e) =>
                        updateSetting("inventory", "defaultMinStock", Number.parseInt(e.target.value) || 0)
                      }
                      className="w-24"
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">Default minimum stock level for new products</p>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="default-stock">Default Initial Stock</Label>
                  <div className="flex items-center gap-4">
                    <Input
                      id="default-stock"
                      type="number"
                      min={0}
                      value={settings.inventory.defaultStock}
                      onChange={(e) => updateSetting("inventory", "defaultStock", Number.parseInt(e.target.value) || 0)}
                      className="w-24"
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">Default initial stock level for new products</p>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="default-category">Default Category</Label>
                  <Select
                    value={settings.inventory.defaultCategoryId}
                    onValueChange={(value: string) => updateSetting("inventory", "defaultCategoryId", value)}
                  >
                    <SelectTrigger id="default-category">
                      <SelectValue
                        placeholder={isLoadingCategories ? "Loading categories..." : "Select default category"}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="no-category">No Default Category</SelectItem>
                      {isLoadingCategories ? (
                        <SelectItem value="loading" disabled>
                          <div className="flex items-center">
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Loading categories...
                          </div>
                        </SelectItem>
                      ) : categories.length === 0 ? (
                        <SelectItem value="no-categories" disabled>
                          No categories available
                        </SelectItem>
                      ) : (
                        categories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">Default category for new products</p>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="price-format">Price Format</Label>
                  <Select
                    value={settings.inventory.priceFormat}
                    onValueChange={(value: string) =>
                      updateSetting("inventory", "priceFormat", value as "fixed" | "percentage")
                    }
                  >
                    <SelectTrigger id="price-format">
                      <SelectValue placeholder="Select price format" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed">Fixed Prices</SelectItem>
                      <SelectItem value="percentage">Percentage Margin</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">Choose how prices are calculated by default</p>
                </div>

                {settings.inventory.priceFormat === "fixed" ? (
                  <>
                    <Separator />

                    <div className="space-y-2">
                      <Label htmlFor="default-selling-price">Default Selling Price</Label>
                      <div className="flex items-center gap-4">
                        <Input
                          id="default-selling-price"
                          type="text"
                          value={settings.inventory.defaultSellingPrice}
                          onChange={(e) => updateSetting("inventory", "defaultSellingPrice", e.target.value)}
                          className="w-24"
                        />
                        <span>DH</span>
                      </div>
                      <p className="text-sm text-muted-foreground">Default selling price for new products</p>
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <Label htmlFor="default-purchase-price">Default Purchase Price</Label>
                      <div className="flex items-center gap-4">
                        <Input
                          id="default-purchase-price"
                          type="text"
                          value={settings.inventory.defaultPurchasePrice}
                          onChange={(e) => updateSetting("inventory", "defaultPurchasePrice", e.target.value)}
                          className="w-24"
                        />
                        <span>DH</span>
                      </div>
                      <p className="text-sm text-muted-foreground">Default purchase price for new products</p>
                    </div>
                  </>
                ) : (
                  <>
                    <Separator />

                    <div className="space-y-2">
                      <Label htmlFor="default-margin">Default Margin Percentage</Label>
                      <div className="flex items-center gap-4">
                        <Slider
                          id="default-margin"
                          min={5}
                          max={100}
                          step={5}
                          value={[settings.inventory.defaultMargin]}
                          onValueChange={(value: number[]) => updateSetting("inventory", "defaultMargin", value[0])}
                          className="flex-1"
                        />
                        <span className="w-12 text-center">{settings.inventory.defaultMargin}%</span>
                      </div>
                      <p className="text-sm text-muted-foreground">Default profit margin percentage for new products</p>
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <Label htmlFor="default-purchase-price">Default Purchase Price</Label>
                      <div className="flex items-center gap-4">
                        <Input
                          id="default-purchase-price"
                          type="text"
                          value={settings.inventory.defaultPurchasePrice}
                          onChange={(e) => updateSetting("inventory", "defaultPurchasePrice", e.target.value)}
                          className="w-24"
                        />
                        <span>DH</span>
                      </div>
                      <p className="text-sm text-muted-foreground">Default purchase price for new products</p>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Scanning Settings */}
        <TabsContent value="scanning">
          <Card>
            <CardHeader>
              <CardTitle>Scanning Settings</CardTitle>
              <CardDescription>Configure barcode scanning behavior and preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="auto-save" className="flex flex-col">
                    <span>Auto-Save Products</span>
                    <span className="text-sm text-muted-foreground">Automatically save products after scanning</span>
                  </Label>
                  <Switch
                    id="auto-save"
                    checked={settings.scanning.autoSave}
                    onCheckedChange={(checked: boolean) => updateSetting("scanning", "autoSave", checked)}
                  />
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="preferred-scanner">Preferred Scanner</Label>
                  <Select
                    value={settings.scanning.preferredScanner}
                    onValueChange={(value: string) =>
                      updateSetting("scanning", "preferredScanner", value as "camera" | "manual" | "demo")
                    }
                  >
                    <SelectTrigger id="preferred-scanner">
                      <SelectValue placeholder="Select scanner type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="camera">Camera Scanner</SelectItem>
                      <SelectItem value="manual">Manual Entry</SelectItem>
                      <SelectItem value="demo">Demo Scanner</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">Choose your preferred scanning method</p>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <Label htmlFor="auto-detect" className="flex flex-col">
                    <span>Auto-Detect Barcodes</span>
                    <span className="text-sm text-muted-foreground">Automatically detect barcodes when scanning</span>
                  </Label>
                  <Switch
                    id="auto-detect"
                    checked={settings.scanning.autoDetect}
                    onCheckedChange={(checked: boolean) => updateSetting("scanning", "autoDetect", checked)}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <Label htmlFor="beep-on-scan" className="flex flex-col">
                    <span>Beep on Scan</span>
                    <span className="text-sm text-muted-foreground">Play a sound when a barcode is detected</span>
                  </Label>
                  <Switch
                    id="beep-on-scan"
                    checked={settings.scanning.beepOnScan}
                    onCheckedChange={(checked: boolean) => updateSetting("scanning", "beepOnScan", checked)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Advanced Settings */}
        <TabsContent value="advanced">
          <Card>
            <CardHeader>
              <CardTitle>Advanced Settings</CardTitle>
              <CardDescription>Configure advanced options and manage categories</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="debug-mode" className="flex flex-col">
                    <span>Debug Mode</span>
                    <span className="text-sm text-muted-foreground">Show additional debugging information</span>
                  </Label>
                  <Switch
                    id="debug-mode"
                    checked={settings.advanced.debugMode}
                    onCheckedChange={(checked: boolean) => updateSetting("advanced", "debugMode", checked)}
                  />
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="history-days">Keep History (Days)</Label>
                  <div className="flex items-center gap-4">
                    <Slider
                      id="history-days"
                      min={7}
                      max={90}
                      step={1}
                      value={[settings.advanced.keepHistoryDays]}
                      onValueChange={(value: number[]) => updateSetting("advanced", "keepHistoryDays", value[0])}
                      className="flex-1"
                    />
                    <span className="w-12 text-center">{settings.advanced.keepHistoryDays}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Number of days to keep scan history</p>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="max-history">Maximum History Items</Label>
                  <div className="flex items-center gap-4">
                    <Slider
                      id="max-history"
                      min={50}
                      max={500}
                      step={50}
                      value={[settings.advanced.maxHistoryItems]}
                      onValueChange={(value: number[]) => updateSetting("advanced", "maxHistoryItems", value[0])}
                      className="flex-1"
                    />
                    <span className="w-12 text-center">{settings.advanced.maxHistoryItems}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Maximum number of items to keep in scan history</p>
                </div>

                <Separator />

                <div className="pt-4">
                  <h3 className="text-lg font-medium mb-4">Category Management</h3>
                  <CategoryManagement />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Reset Confirmation Dialog */}
      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Settings</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to reset all settings to their default values? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={resetSettings} className="bg-destructive text-destructive-foreground">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Reset All Settings
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

