"use client"

import { useState, useEffect } from "react"
import { useForm, type ControllerRenderProps } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { fetchCategories, createDefaultCategoryIfNeeded } from "@/services/category-service"
import type { Product, Category } from "@/types/product"

const productFormSchema = z.object({
  id: z.string().optional().nullable(),
  name: z.string().min(2, {
    message: "Product name must be at least 2 characters.",
  }),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/, {
    message: "Price must be a valid number with up to 2 decimal places.",
  }),
  purchase_price: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, {
      message: "Purchase price must be a valid number with up to 2 decimal places.",
    })
    .optional(),
  image: z.string().optional(),
  barcode: z.string().optional(),
  stock: z.coerce.number().default(0),
  min_stock: z.coerce.number().default(0),
  category_id: z.string().optional(),
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
  const [isLoadingCategories, setIsLoadingCategories] = useState(false)

  useEffect(() => {
    // Only fetch categories if they weren't provided as props
    if (!propCategories || propCategories.length === 0) {
      const loadCategories = async () => {
        setIsLoadingCategories(true)
        try {
          console.log("ProductForm: Loading categories...")
          const categoryList = await fetchCategories()
          console.log("ProductForm: Categories loaded:", categoryList)

          if (categoryList.length === 0) {
            console.log("ProductForm: No categories found, creating defaults...")
            await createDefaultCategoryIfNeeded()

            // Try to fetch categories again
            const refreshedList = await fetchCategories()

            // If still no categories, use local mock categories
            if (refreshedList.length === 0) {
              console.log("ProductForm: Still no categories, using local mock categories")
              setCategories([
                { id: "local-1", name: "Beverages" },
                { id: "local-2", name: "Dairy" },
                { id: "local-3", name: "Snacks" },
                { id: "local-4", name: "Groceries" },
                { id: "local-5", name: "Household" },
                { id: "local-6", name: "Personal Care" },
                { id: "local-7", name: "Other" },
              ])
            } else {
              setCategories(refreshedList)
            }
          } else {
            setCategories(categoryList)
          }
        } catch (error) {
          console.error("Failed to load categories:", error)
          toast({
            title: "Error",
            description: "Failed to load categories. Using local categories instead.",
            variant: "destructive",
          })

          // Use local mock categories as fallback
          setCategories([
            { id: "local-1", name: "Beverages" },
            { id: "local-2", name: "Dairy" },
            { id: "local-3", name: "Snacks" },
            { id: "local-4", name: "Groceries" },
            { id: "local-5", name: "Household" },
            { id: "local-6", name: "Personal Care" },
            { id: "local-7", name: "Other" },
          ])
        } finally {
          setIsLoadingCategories(false)
        }
      }

      loadCategories()
    } else {
      console.log("ProductForm: Using provided categories:", propCategories)
      setCategories(propCategories)
    }
  }, [toast, propCategories])

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: initialFormValues.name || "",
      price: initialFormValues.price || "",
      purchase_price: initialFormValues.purchase_price ? String(initialFormValues.purchase_price) : "",
      image: initialFormValues.image || "",
      barcode: initialFormValues.barcode || "",
      stock: initialFormValues.stock || 0,
      min_stock: initialFormValues.min_stock || 0,
      category_id: initialFormValues.category_id || "",
      expiry_date: initialFormValues.expiry_date || null,
      expiry_notification_days: initialFormValues.expiry_notification_days || null,
      id: initialFormValues.id || null,
    },
  })

  function onSubmit(values: ProductFormValues) {
    // Remove empty ID field
    if (values.id === "" || values.id === null) {
      delete values.id
    }

    // Convert purchase_price from string to number if present
    const processedValues = {
      ...values,
      purchase_price: values.purchase_price ? Number.parseFloat(values.purchase_price) : undefined,
    }

    handleSave(processedValues as Product)
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
              <FormLabel>Selling Price</FormLabel>
              <FormControl>
                <Input placeholder="Selling price" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="purchase_price"
          render={({ field }: { field: ControllerRenderProps<ProductFormValues, "purchase_price"> }) => (
            <FormItem>
              <FormLabel>Purchase Price</FormLabel>
              <FormControl>
                <Input placeholder="Purchase price" {...field} />
              </FormControl>
              <FormDescription>The price you paid to acquire this product</FormDescription>
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
                    <SelectValue placeholder={isLoadingCategories ? "Loading categories..." : "Select a category"} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {isLoadingCategories ? (
                    <SelectItem value="loading" disabled>
                      Loading categories...
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
              <FormMessage />
            </FormItem>
          )}
        />

        {process.env.NODE_ENV !== "production" && (
          <div className="mt-4 p-2 bg-muted rounded-md">
            <p className="text-xs font-mono mb-2">Debug Info:</p>
            <p className="text-xs font-mono">Categories loaded: {categories.length}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2 text-xs"
              onClick={async () => {
                try {
                  const refreshedCategories = await fetchCategories()
                  setCategories(refreshedCategories)
                  toast({
                    title: "Categories Refreshed",
                    description: `Loaded ${refreshedCategories.length} categories`,
                  })
                } catch (err) {
                  console.error("Error refreshing categories:", err)
                }
              }}
            >
              Refresh Categories
            </Button>
          </div>
        )}

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

