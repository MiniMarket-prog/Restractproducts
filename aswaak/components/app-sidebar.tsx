"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Home, Settings, Menu, Barcode, Search, ClipboardList, Clock, Tag, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/use-mobile"

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {}

export function AppSidebar({ className }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)

  // Close the sidebar when navigating on mobile
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  const navItems = [
    {
      title: "Home",
      href: "/",
      icon: Home,
    },
    {
      title: "Scan",
      href: "/?tab=scan",
      icon: Barcode,
    },
    {
      title: "Search",
      href: "/?tab=search",
      icon: Search,
    },
    {
      title: "Manual Entry",
      href: "/?tab=manual",
      icon: ClipboardList,
    },
    {
      title: "History",
      href: "/?tab=history",
      icon: Clock,
    },
    {
      title: "Categories",
      href: "/settings?tab=categories",
      icon: Tag,
    },
    {
      title: "Settings",
      href: "/settings",
      icon: Settings,
    },
  ]

  const isActive = (href: string) => {
    if (href === "/") {
      return pathname === "/"
    }
    return pathname.startsWith(href.split("?")[0])
  }

  const SidebarContent = (
    <div className={cn("flex h-full flex-col", className)}>
      <div className="px-3 py-2">
        <div className="flex h-12 items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <Barcode className="h-6 w-6" />
            <span className="text-xl">Barcode Scanner</span>
          </Link>
          {isMobile && (
            <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
              <X className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>
      <ScrollArea className="flex-1 px-2">
        <nav className="flex flex-col gap-1 py-2">
          {navItems.map((item, index) => (
            <Link key={index} href={item.href} onClick={() => isMobile && setOpen(false)}>
              <Button
                variant={isActive(item.href) ? "secondary" : "ghost"}
                className={cn("w-full justify-start gap-2", isActive(item.href) ? "font-medium" : "font-normal")}
              >
                <item.icon className="h-4 w-4" />
                <span>{item.title}</span>
              </Button>
            </Link>
          ))}
        </nav>
      </ScrollArea>
    </div>
  )

  // For mobile, use a Sheet component
  if (isMobile) {
    return (
      <>
        <div className="flex h-14 items-center border-b px-4">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="mr-2">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle Menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[240px] p-0">
              {SidebarContent}
            </SheetContent>
          </Sheet>
          <div className="flex-1 text-center">
            <h1 className="text-lg font-semibold">
              {pathname === "/" ? "Barcode Scanner" : pathname === "/settings" ? "Settings" : "Barcode Scanner"}
            </h1>
          </div>
        </div>
      </>
    )
  }

  // For desktop, show the sidebar directly
  return <div className="hidden border-r bg-background md:block md:w-[240px]">{SidebarContent}</div>
}

