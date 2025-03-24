import type { ReactNode } from "react"

export interface MainNavItem {
  title: string
  href: string
  icon?: ReactNode
  disabled?: boolean
}

// Re-export other types
export * from "./product"

