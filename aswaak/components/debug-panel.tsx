"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { testSupabaseConnection } from "@/lib/supabase"
import { fetchCategories } from "@/services/category-service"

export function DebugPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<{ success: boolean; message: string } | null>(null)
  const [categories, setCategories] = useState<any[]>([])
  const [envVars, setEnvVars] = useState<{ [key: string]: string }>({})

  useEffect(() => {
    // Get environment variables
    setEnvVars({
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? "Set" : "Not set",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        ? `Set (starts with ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.substring(0, 3)}...)`
        : "Not set",
    })
  }, [])

  const testConnection = async () => {
    const result = await testSupabaseConnection()
    setConnectionStatus(result)
  }

  const loadCategories = async () => {
    const cats = await fetchCategories()
    setCategories(cats)
  }

  if (!isOpen) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button variant="outline" size="sm" onClick={() => setIsOpen(true)} className="bg-background shadow-md">
          Debug
        </Button>
      </div>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex justify-between items-center">
            <span>Debug Panel</span>
            <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
              ×
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs space-y-2">
          <div>
            <h3 className="font-semibold mb-1">Environment Variables:</h3>
            <div className="bg-muted p-2 rounded">
              {Object.entries(envVars).map(([key, value]) => (
                <div key={key} className="flex justify-between">
                  <span>{key}:</span>
                  <span>{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-1">Supabase Connection:</h3>
            <div className="flex gap-2 mb-2">
              <Button size="sm" variant="outline" onClick={testConnection} className="text-xs">
                Test Connection
              </Button>
            </div>
            {connectionStatus && (
              <div
                className={`p-2 rounded ${connectionStatus.success ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}
              >
                {connectionStatus.message}
              </div>
            )}
          </div>

          <div>
            <h3 className="font-semibold mb-1">Categories:</h3>
            <div className="flex gap-2 mb-2">
              <Button size="sm" variant="outline" onClick={loadCategories} className="text-xs">
                Load Categories
              </Button>
            </div>
            <div className="bg-muted p-2 rounded max-h-32 overflow-y-auto">
              {categories.length === 0 ? (
                <span>No categories loaded</span>
              ) : (
                categories.map((cat, i) => (
                  <div key={i} className="flex justify-between">
                    <span>{cat.name}</span>
                    <span className="text-muted-foreground">{cat.id.substring(0, 6)}...</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

