"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, Camera, CameraOff } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface BarcodeScannerProps {
  onBarcodeDetected: (barcode: string) => void
  isLoading: boolean
}

export function BarcodeScanner({ onBarcodeDetected, isLoading }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isCameraActive, setIsCameraActive] = useState(false)
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)
  const { toast } = useToast()

  // This would normally use a barcode scanning library like quagga.js or zxing
  // For demo purposes, we'll simulate barcode detection with a button

  const toggleCamera = async () => {
    if (isCameraActive) {
      // Stop the camera
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks()
        tracks.forEach((track) => track.stop())
        videoRef.current.srcObject = null
      }
      setIsCameraActive(false)
    } else {
      try {
        // Start the camera
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        })

        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }

        setIsCameraActive(true)
        setHasPermission(true)
      } catch (err) {
        console.error("Error accessing camera:", err)
        setHasPermission(false)
        toast({
          title: "Camera Error",
          description: "Could not access the camera. Please check permissions.",
          variant: "destructive",
        })
      }
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks()
        tracks.forEach((track) => track.stop())
      }
    }
  }, [])

  // Simulate barcode detection
  const simulateScan = () => {
    // In a real app, this would be detected from the camera feed
    const mockBarcode = "6111245591063"
    onBarcodeDetected(mockBarcode)
  }

  return (
    <Card className="mb-4">
      <CardContent className="p-4 flex flex-col items-center">
        <div className="relative w-full aspect-[4/3] bg-muted rounded-lg overflow-hidden mb-4">
          {isCameraActive ? (
            <video ref={videoRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <CameraOff className="h-12 w-12 text-muted-foreground" />
            </div>
          )}

          {/* Scanning overlay */}
          {isCameraActive && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-3/4 h-1/4 border-2 border-primary rounded-lg"></div>
            </div>
          )}
        </div>

        <div className="flex gap-2 w-full">
          <Button variant="outline" className="flex-1" onClick={toggleCamera}>
            {isCameraActive ? (
              <>
                <CameraOff className="mr-2 h-4 w-4" />
                Stop Camera
              </>
            ) : (
              <>
                <Camera className="mr-2 h-4 w-4" />
                Start Camera
              </>
            )}
          </Button>

          <Button className="flex-1" onClick={simulateScan} disabled={isLoading || !isCameraActive}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Scanning...
              </>
            ) : (
              "Scan Barcode"
            )}
          </Button>
        </div>

        {hasPermission === false && (
          <p className="text-sm text-destructive mt-2">Camera access denied. Please check your browser settings.</p>
        )}
      </CardContent>
    </Card>
  )
}

