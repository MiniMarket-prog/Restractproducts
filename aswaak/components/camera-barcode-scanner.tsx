"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Camera, X, RefreshCw, Loader2, Zap, ZapOff, CameraIcon } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

// Add a reference to the declaration file instead of importing
/// <reference path="../../types/quagga.d.ts" />

// Import Quagga with proper type handling
let Quagga: typeof import("quagga").default | null = null

// This ensures Quagga is only imported on the client side
if (typeof window !== "undefined") {
  import("quagga")
    .then((module) => {
      Quagga = module.default
    })
    .catch((err) => {
      console.error("Failed to load Quagga:", err)
    })
}

interface CameraBarcodeProps {
  onBarcodeDetected: (barcode: string) => void
  isLoading?: boolean
}

export function CameraBarcodeScanner({ onBarcodeDetected, isLoading = false }: CameraBarcodeProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment")
  const [quaggaLoaded, setQuaggaLoaded] = useState(false)
  const [autoDetect, setAutoDetect] = useState(true)
  const [lastDetectedCode, setLastDetectedCode] = useState<string | null>(null)
  const [lastDetectedTime, setLastDetectedTime] = useState<number>(0)
  const [isCapturing, setIsCapturing] = useState(false)
  const scannerRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()
  // Add a flag to track initialization state
  const [isQuaggaInitialized, setIsQuaggaInitialized] = useState(false)

  // Load Quagga when component mounts
  useEffect(() => {
    if (typeof window !== "undefined" && !quaggaLoaded) {
      import("quagga")
        .then((module) => {
          Quagga = module.default
          setQuaggaLoaded(true)
        })
        .catch((err) => {
          console.error("Failed to load Quagga:", err)
          toast({
            title: "Error",
            description: "Failed to load barcode scanner library",
            variant: "destructive",
          })
        })
    }
  }, [quaggaLoaded, toast])

  // Initialize and start Quagga when the dialog opens
  useEffect(() => {
    if (!isOpen || !scannerRef.current || !Quagga || !quaggaLoaded) return

    let isMounted = true
    const startScanner = async () => {
      if (!Quagga || !scannerRef.current) {
        toast({
          title: "Error",
          description: "Barcode scanner not initialized properly",
          variant: "destructive",
        })
        return
      }

      try {
        await Quagga.init(
          {
            inputStream: {
              name: "Live",
              type: "LiveStream",
              target: scannerRef.current,
              constraints: {
                facingMode: facingMode,
                width: { min: 640 },
                height: { min: 480 },
                aspectRatio: { min: 1, max: 2 },
              },
            },
            locator: {
              patchSize: "medium",
              halfSample: true,
            },
            numOfWorkers: 2,
            frequency: 10,
            decoder: {
              readers: [
                "ean_reader",
                "ean_8_reader",
                "code_39_reader",
                "code_128_reader",
                "upc_reader",
                "upc_e_reader",
              ],
              multiple: false,
            },
            locate: true,
          },
          (err: Error | null) => {
            if (!isMounted) return

            if (err) {
              console.error("Error initializing Quagga:", err)
              toast({
                title: "Scanner initialization failed",
                description: "Could not start the barcode scanner. Please try again.",
                variant: "destructive",
              })
              return
            }

            setIsScanning(true)
            setIsQuaggaInitialized(true)
            if (Quagga) Quagga.start()
          },
        )

        // Set up the detection callback
        if (Quagga) {
          const onDetectedHandler = (result: any) => {
            if (result && result.codeResult && result.codeResult.code) {
              const barcode = result.codeResult.code
              const currentTime = Date.now()

              // Prevent duplicate scans within 2 seconds and check if the code is different
              if (
                (currentTime - lastDetectedTime > 2000 || lastDetectedCode !== barcode) &&
                barcode.length >= 8 // Ensure the barcode is at least 8 characters long
              ) {
                // Play a success sound
                try {
                  const audio = new Audio("/sounds/beep.mp3")
                  audio.play().catch((e) => console.log("Audio play failed:", e))
                } catch (e) {
                  console.log("Audio play failed:", e)
                }

                // Update last detected code and time
                setLastDetectedCode(barcode)
                setLastDetectedTime(currentTime)

                // If auto-detect is enabled, process the barcode immediately
                if (autoDetect) {
                  // Stop scanning and close the dialog
                  stopScanner()
                  setIsOpen(false)

                  // Call the callback with the detected barcode
                  onBarcodeDetected(barcode)

                  // Show a success toast
                  toast({
                    title: "Barcode detected",
                    description: `Detected barcode: ${barcode}`,
                  })
                } else {
                  // Just show the detected barcode in the UI
                  setLastDetectedCode(barcode)

                  // Show a toast notification
                  toast({
                    title: "Barcode detected",
                    description: `Tap "Use This Code" to process barcode: ${barcode}`,
                  })
                }
              }
            }
          }

          Quagga.onDetected(onDetectedHandler)

          // Return cleanup function to remove event listener
          return () => {
            isMounted = false
            if (Quagga) {
              try {
                Quagga.offDetected(onDetectedHandler)
                Quagga.stop()
              } catch (e) {
                console.log("Error cleaning up Quagga:", e)
              }
            }
            setIsScanning(false)
          }
        }
      } catch (error) {
        console.error("Error starting Quagga:", error)
        if (isMounted) {
          toast({
            title: "Camera access error",
            description: "Could not access your camera. Please check permissions.",
            variant: "destructive",
          })
        }
      }
    }

    startScanner()

    // Cleanup function
    return () => {
      isMounted = false
      if (isQuaggaInitialized && Quagga) {
        try {
          Quagga.stop()
          console.log("Quagga stopped during cleanup")
        } catch (e) {
          console.log("Error stopping Quagga during cleanup:", e)
        }
        setIsQuaggaInitialized(false)
      }
      setIsScanning(false)
    }
  }, [isOpen, facingMode, toast, onBarcodeDetected, quaggaLoaded, autoDetect, lastDetectedCode, lastDetectedTime])

  // Update the stopScanner function
  const stopScanner = () => {
    if (isQuaggaInitialized && Quagga) {
      try {
        Quagga.stop()
        console.log("Quagga stopped successfully")
      } catch (e) {
        console.log("Error stopping Quagga:", e)
      }
      setIsQuaggaInitialized(false)
    }
    setIsScanning(false)
    setLastDetectedCode(null)
    setLastDetectedTime(0)
    setIsCapturing(false)
  }

  // Add this function after the stopScanner function
  const resetScanner = () => {
    stopScanner()
    setFacingMode("environment")
    setAutoDetect(true)
    setLastDetectedCode(null)
    setLastDetectedTime(0)
    setIsCapturing(false)
  }

  // Add this useEffect hook
  useEffect(() => {
    // Reset scanner when component unmounts
    return () => {
      resetScanner()
    }
  }, [])

  // Switch camera between front and back
  const switchCamera = () => {
    stopScanner()
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"))
  }

  // Handle manual barcode submission
  const handleUseDetectedCode = () => {
    if (lastDetectedCode) {
      stopScanner()
      setIsOpen(false)
      onBarcodeDetected(lastDetectedCode)
    }
  }

  // Toggle auto-detect mode
  const toggleAutoDetect = () => {
    setAutoDetect(!autoDetect)
  }

  // Manual capture function
  const handleManualCapture = async () => {
    if (!Quagga) {
      toast({
        title: "Error",
        description: "Scanner not initialized",
        variant: "destructive",
      })
      return
    }

    setIsCapturing(true)

    try {
      // Define a proper type for the callback - use any for now to avoid type errors
      const processCallback = (result: any) => {
        // Remove the event listener to make it one-time
        if (Quagga) {
          Quagga.offProcessed(processCallback)
        }

        if (result && result.codeResult && result.codeResult.code) {
          const barcode = result.codeResult.code

          // Play a success sound
          try {
            const audio = new Audio("/sounds/beep.mp3")
            audio.play().catch((e) => console.log("Audio play failed:", e))
          } catch (e) {
            console.log("Audio play failed:", e)
          }

          setLastDetectedCode(barcode)
          setLastDetectedTime(Date.now())

          toast({
            title: "Barcode captured",
            description: `Captured barcode: ${barcode}`,
          })
        } else {
          toast({
            title: "No barcode found",
            description: "Try adjusting the camera position or lighting",
            variant: "destructive",
          })
        }

        setIsCapturing(false)
      }

      // Register the callback
      if (Quagga) {
        Quagga.onProcessed(processCallback)

        // Force a scan by temporarily increasing the frequency
        // This is a workaround since _processFrame is not in the type definition
        const currentFrequency = 10 // Default frequency

        // Temporarily set a higher frequency to trigger a scan
        await new Promise<void>((resolve) => {
          // Wait a short time for the next processing cycle
          setTimeout(() => {
            resolve()
          }, 100)
        })
      } else {
        throw new Error("Quagga is not initialized")
      }
    } catch (error) {
      console.error("Error during manual capture:", error)
      toast({
        title: "Capture failed",
        description: "An error occurred during capture",
        variant: "destructive",
      })
      setIsCapturing(false)
    }
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1 w-full"
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Scanning...
          </>
        ) : (
          <>
            <Camera className="h-4 w-4 mr-2" />
            Scan Barcode
          </>
        )}
      </Button>

      <Dialog
        open={isOpen}
        onOpenChange={(open) => {
          setIsOpen(open)
          if (!open) stopScanner()
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Scan Barcode</DialogTitle>
            <div className="flex items-center space-x-2 mt-2">
              <Switch id="auto-detect" checked={autoDetect} onCheckedChange={toggleAutoDetect} />
              <Label htmlFor="auto-detect" className="flex items-center cursor-pointer">
                {autoDetect ? <Zap className="h-4 w-4 mr-1" /> : <ZapOff className="h-4 w-4 mr-1" />}
                Auto-detect {autoDetect ? "ON" : "OFF"}
              </Label>
            </div>
          </DialogHeader>

          <div className="relative aspect-video bg-black rounded-md overflow-hidden">
            <div ref={scannerRef} className="absolute inset-0 w-full h-full">
              {/* Quagga will insert the video element here */}
            </div>

            {/* Scanning overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-4/5 h-1/4 border-2 border-white rounded-md opacity-50"></div>
            </div>
          </div>

          {/* Manual capture button */}
          <Button className="w-full" onClick={handleManualCapture} disabled={isCapturing}>
            {isCapturing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CameraIcon className="h-4 w-4 mr-2" />}
            {isCapturing ? "Capturing..." : "Capture Manually"}
          </Button>

          {lastDetectedCode && !autoDetect && (
            <div className="bg-muted p-2 rounded-md">
              <p className="text-sm font-medium">Detected: {lastDetectedCode}</p>
              <Button className="w-full mt-2" onClick={handleUseDetectedCode} variant="default">
                Use This Code
              </Button>
            </div>
          )}

          <DialogFooter className="flex justify-between">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>

            <Button variant="outline" onClick={switchCamera}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Switch Camera
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

