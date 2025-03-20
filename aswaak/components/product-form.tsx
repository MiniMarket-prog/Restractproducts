"use client"

import type React from "react"

import { useState } from "react"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Calendar } from "lucide-react"
import type { Product, Category } from "@/types/product"
import { saveProduct } from "@/services/product-service"
import { useToast } from "@/hooks/use-toast"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { format } from "date-fns"

interface ProductFormProps {
  initialData: Partial<Product>
  categories: Category[]
  onCancel: () => void
  onSuccess: (product: Product) => void
}

export function ProductForm({ initialData, categories, onCancel, onSuccess }: ProductFormProps) {
  const [formData, setFormData] = useState<Partial<Product>>(initialData)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [date, setDate] = useState<Date | undefined>(
    initialData.expiry_date ? new Date(initialData.expiry_date) : undefined,
  )
  const { toast } = useToast()

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target

    if (type === "number") {
      setFormData({
        ...formData,
        [name]: Number.parseFloat(value),
      })
    } else {
      setFormData({
        ...formData,
        [name]: value,
      })
    }
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData({
      ...formData,
      [name]: value,
    })
  }

  const handleDateChange = (date: Date | undefined) => {
    setDate(date)
    setFormData({
      ...formData,
      expiry_date: date ? format(date, "yyyy-MM-dd") : undefined,
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name || !formData.price || !formData.barcode) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      })
      return
    }

    try {
      setIsSubmitting(true)

      const savedProduct = await saveProduct(formData as Product)

      toast({
        title: "Success",
        description: "Product saved successfully",
      })

      onSuccess(savedProduct)
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to save product: ${error instanceof Error ? error.message : String(error)}`,
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle>{initialData.id ? "Edit Product" : "Add New Product"}</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Product Name *</Label>
            <Input id="name" name="name" value={formData.name || ""} onChange={handleChange} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="price">Price *</Label>
            <Input id="price" name="price" value={formData.price || ""} onChange={handleChange} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="barcode">Barcode *</Label>
            <Input
              id="barcode"
              name="barcode"
              value={formData.barcode || ""}
              onChange={handleChange}
              required
              readOnly={!!initialData.id} // Make barcode readonly if editing
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="stock">Current Stock</Label>
              <Input id="stock" name="stock" type="number" value={formData.stock || 0} onChange={handleChange} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="min_stock">Minimum Stock</Label>
              <Input
                id="min_stock"
                name="min_stock"
                type="number"
                value={formData.min_stock || 0}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category_id">Category</Label>
            <Select
              value={formData.category_id || ""}
              onValueChange={(value) => handleSelectChange("category_id", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="purchase_price">Purchase Price</Label>
            <Input
              id="purchase_price"
              name="purchase_price"
              type="number"
              step="0.01"
              value={formData.purchase_price || ""}
              onChange={handleChange}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="expiry_date">Expiry Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <Calendar className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP") : "Select a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <CalendarComponent mode="single" selected={date} onSelect={handleDateChange} initialFocus />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="expiry_notification_days">Expiry Notification Days</Label>
            <Input
              id="expiry_notification_days"
              name="expiry_notification_days"
              type="number"
              value={formData.expiry_notification_days || 30}
              onChange={handleChange}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="image">Image URL</Label>
            <Input id="image" name="image" value={formData.image || ""} onChange={handleChange} />
          </div>
        </CardContent>

        <CardFooter className="flex justify-between">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Product"
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}

