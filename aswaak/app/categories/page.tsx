"use client"

import { CategoryManagement } from "@/components/category-management"

export default function CategoriesPage() {
  return (
    <div className="container py-6 max-w-4xl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Categories</h1>
          <p className="text-muted-foreground">Manage your product categories</p>
        </div>
      </div>

      <CategoryManagement />
    </div>
  )
}

