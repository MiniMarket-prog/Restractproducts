"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import type { MainNavItem } from "@/types"
import { Package } from "lucide-react"

interface MainNavProps {
  items?: MainNavItem[]
}

export function MainNav({ items }: MainNavProps) {
  const pathname = usePathname()

  // Default items if none provided
  const navItems: MainNavItem[] = items || [
    {
      title: "Dashboard",
      href: "/",
    },
    {
      title: "Scanner",
      href: "/scanner",
    },
    {
      title: "Products",
      href: "/products",
    },
    {
      title: "Incomplete Products",
      href: "/incomplete-products",
      icon: <Package className="mr-2 h-4 w-4" />,
    },
    {
      title: "System Status",
      href: "/system-status",
    },
  ]

  return (
    <div className="flex gap-6 md:gap-10">
      <Link href="/" className="hidden items-center space-x-2 md:flex">
        <span className="hidden font-bold sm:inline-block">Barcode Scanner</span>
      </Link>
      <nav className="flex gap-6">
        {navItems?.map((item, index) => (
          <Link
            key={index}
            href={item.href}
            className={cn(
              "flex items-center text-sm font-medium transition-colors hover:text-primary",
              pathname === item.href ? "text-primary" : "text-muted-foreground",
              item.disabled && "cursor-not-allowed opacity-80",
            )}
          >
            {item.icon}
            {item.title}
          </Link>
        ))}
      </nav>
    </div>
  )
}

