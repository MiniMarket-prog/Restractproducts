import { ModeToggle } from "@/components/mode-toggle"
import { ShoppingBag } from "lucide-react"

export function AppHeader() {
  return (
    <header className="sticky top-0 z-10 w-full bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
      <div className="container flex h-14 items-center">
        <div className="flex items-center gap-2 font-semibold">
          <ShoppingBag className="h-5 w-5 text-primary" />
          <span>Aswak Scanner</span>
        </div>
        <div className="flex flex-1 items-center justify-end">
          <ModeToggle />
        </div>
      </div>
    </header>
  )
}

