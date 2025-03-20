"use client"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, Camera } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { CameraBarcodeScanner } from "@/components/camera-barcode-scanner"

interface BarcodeScannerProps {
  onBarcodeDetected: (barcode: string) => void
  isLoading: boolean
}

export function BarcodeScanner({ onBarcodeDetected, isLoading }: BarcodeScannerProps) {
  const { toast } = useToast()

  // For demo purposes, we'll keep the manual scan button
  const simulateScan = () => {
    // In a real app, this would be detected from the camera feed
    const mockBarcode = "6111245591063"
    onBarcodeDetected(mockBarcode)
  }

  return (
    <Card className="mb-4">
      <CardContent className="p-4 flex flex-col items-center">
        <div className="w-full flex flex-col gap-4 mt-4">
          <CameraBarcodeScanner onBarcodeDetected={onBarcodeDetected} isLoading={isLoading} />

          <Button className="w-full" variant="secondary" onClick={simulateScan} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Scanning...
              </>
            ) : (
              <>
                <Camera className="mr-2 h-4 w-4" />
                Demo Scan (6111245591063)
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

