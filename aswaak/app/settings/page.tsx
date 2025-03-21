"use client"
import { CategoryManagement } from "@/components/category-management"

export default function SettingsPage() {
  return (
    <div className="w-full max-w-4xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      <CategoryManagement />
    </div>
  )
}

