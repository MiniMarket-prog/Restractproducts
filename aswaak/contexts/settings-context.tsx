"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"

// Define the settings interface
export interface AppSettings {
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
    defaultSellingPrice: string // Add default selling price
    defaultPurchasePrice: string // Add default purchase price
    priceFormat: "fixed" | "percentage" // Add price format option
    defaultMargin: number // Add default margin percentage
    defaultCategoryId: string // Add default category ID
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
export const defaultSettings: AppSettings = {
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
    defaultSellingPrice: "0.00", // Default selling price
    defaultPurchasePrice: "0.00", // Default purchase price
    priceFormat: "fixed", // Default to fixed prices
    defaultMargin: 30, // Default 30% margin
    defaultCategoryId: "", // Default category ID (empty string means no default)
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

interface SettingsContextType {
  settings: AppSettings
  updateSetting: <T extends keyof AppSettings, K extends keyof AppSettings[T]>(
    category: T,
    key: K,
    value: AppSettings[T][K],
  ) => void
  saveSettings: () => void
  resetSettings: () => void
}

// Add proper type for the context
export const SettingsContext = createContext<SettingsContextType | undefined>(undefined)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings)

  // Load settings from localStorage on component mount
  useEffect(() => {
    const savedSettings = localStorage.getItem("appSettings")
    if (savedSettings) {
      try {
        const parsedSettings = JSON.parse(savedSettings) as AppSettings
        setSettings(parsedSettings)
      } catch (error) {
        console.error("Error parsing saved settings:", error)
        // If there's an error, use default settings
        setSettings(defaultSettings)
      }
    }
  }, []) // Empty dependency array is correct here

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
  }

  // Save settings to localStorage
  const saveSettings = () => {
    localStorage.setItem("appSettings", JSON.stringify(settings))
  }

  // Reset settings to defaults
  const resetSettings = () => {
    setSettings(defaultSettings)
  }

  return (
    <SettingsContext.Provider value={{ settings, updateSetting, saveSettings, resetSettings }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const context = useContext(SettingsContext)
  if (context === undefined) {
    throw new Error("useSettings must be used within a SettingsProvider")
  }
  return context
}

