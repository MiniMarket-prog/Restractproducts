"use client"

import { useState, useEffect } from "react"
import { useForm, type ControllerRenderProps } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { fetchCategories } from "@/services/product-service"
import type { Product, Category } from "@/types/product"

const productFormSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, {
    message: "Product name must be at least 2 characters.",
  }),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/, {
    message: "Price must be a valid number with up to 2 decimal places.",
  }),
  image: z.string().optional(),
  barcode: z.string().optional(),
  stock: z.coerce.number().default(0),
  min_stock: z.coerce.number().default(0),
  category_id: z.string().optional(),
  purchase_price: z.coerce.number().optional(),
  expiry_date: z.string().optional().nullable(),
  expiry_notification_days: z.coerce.number().optional().nullable(),
})

type ProductFormValues = z.infer<typeof productFormSchema>

interface ProductFormProps {
  initialValues?: Partial<Product>
  initialData?: Partial<Product> // Add this for backward compatibility
  categories?: Category[]
  onSave?: (product: Product) => void
  onSuccess?: (product: Product) => void // Add this for backward compatibility
  onCancel: () => void
  isLoading: boolean
}

export function ProductForm({
  initialValues,
  initialData, // Support both prop names
  categories: propCategories,
  onSave,
  onSuccess, // Support both callback names
  onCancel,
  isLoading,
}: ProductFormProps) {
  // Use either provided initialValues or initialData
  const initialFormValues = initialValues || initialData || {}

  // Use the callback function that's provided
  const handleSave = onSave || onSuccess || ((p: Product) => {})

  const [categories, setCategories] = useState<Category[]>(propCategories || [])
  const { toast } = useToast()

  useEffect(() => {
    // Only fetch categories if they weren't provided as props
    if (!propCategories || propCategories.length === 0) {
      const loadCategories = async () => {
        try {
          const categoryList = await fetchCategories()
          setCategories(categoryList)
        } catch (error) {
          console.error("Failed to load categories:", error)
          toast({
            title: "Error",
            description: "Failed to load categories.",
            variant: "destructive",
          })
        }
      }

      loadCategories()
    }
  }, [toast, propCategories])

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: initialFormValues.name || "",
      price: initialFormValues.price || "",
      image: initialFormValues.image || "",
      barcode: initialFormValues.barcode || "",
      stock: initialFormValues.stock || 0,
      min_stock: initialFormValues.min_stock || 0,
      category_id: initialFormValues.category_id || "",
      purchase_price: initialFormValues.purchase_price || 0,
      expiry_date: initialFormValues.expiry_date || null,
      expiry_notification_days: initialFormValues.expiry_notification_days || null,
      id: initialFormValues.id,
    },
  })

  function onSubmit(values: ProductFormValues) {
    handleSave(values as Product)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="name"
          render={({ field }: { field: ControllerRenderProps<ProductFormValues, "name"> }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="Product name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="price"
          render={({ field }: { field: ControllerRenderProps<ProductFormValues, "price"> }) => (
            <FormItem>
              <FormLabel>Price</FormLabel>
              <FormControl>
                <Input placeholder="Product price" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="image"
          render={({ field }: { field: ControllerRenderProps<ProductFormValues, "image"> }) => (
            <FormItem>
              <FormLabel>Image URL</FormLabel>
              <FormControl>
                <Input placeholder="Image URL" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="barcode"
          render={({ field }: { field: ControllerRenderProps<ProductFormValues, "barcode"> }) => (
            <FormItem>
              <FormLabel>Barcode</FormLabel>
              <FormControl>
                <Input placeholder="Barcode" {...field} disabled={!!initialFormValues.barcode} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="stock"
          render={({ field }: { field: ControllerRenderProps<ProductFormValues, "stock"> }) => (
            <FormItem>
              <FormLabel>Stock</FormLabel>
              <FormControl>
                <Input type="number" placeholder="Stock" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="min_stock"
          render={({ field }: { field: ControllerRenderProps<ProductFormValues, "min_stock"> }) => (
            <FormItem>
              <FormLabel>Minimum Stock</FormLabel>
              <FormControl>
                <Input type="number" placeholder="Minimum Stock" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="category_id"
          render={({ field }: { field: ControllerRenderProps<ProductFormValues, "category_id"> }) => (
            <FormItem>
              <FormLabel>Category</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end space-x-4">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            Save
          </Button>
        </div>
      </form>
    </Form>
  )
}

