"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Camera, X, RefreshCw, AlertTriangle, Info, Play } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface MobileCameraScannerProps {
  onBarcodeDetected: (barcode: string) => void
  isLoading?: boolean
}

export function MobileCameraScanner({ onBarcodeDetected, isLoading = false }: MobileCameraScannerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<string[]>([])
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { toast } = useToast()
  const [showDebugInfo, setShowDebugInfo] = useState(false)
  const [needsUserInteraction, setNeedsUserInteraction] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [lastDetectedCode, setLastDetectedCode] = useState<string | null>(null)
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Add debug info with timestamp
  const addDebugInfo = (message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    setDebugInfo((prev) => {
      const newInfo = [...prev, `[${timestamp}] ${message}`]
      // Keep only the last 50 messages to avoid memory issues
      if (newInfo.length > 50) {
        return newInfo.slice(newInfo.length - 50)
      }
      return newInfo
    })
    console.log(`[Camera Debug] ${message}`)
  }

  // Check if BarcodeDetector is available
  const isBarcodeDetectorSupported = typeof window !== "undefined" && "BarcodeDetector" in window

  // Start camera when dialog opens
  useEffect(() => {
    if (!isOpen) return

    let stream: MediaStream | null = null

    const startCamera = async () => {
      try {
        // Clear any previous errors
        setErrorMessage(null)

        // Stop any existing streams
        if (videoRef.current && videoRef.current.srcObject) {
          const oldStream = videoRef.current.srcObject as MediaStream
          oldStream.getTracks().forEach((track) => track.stop())
          videoRef.current.srcObject = null
        }

        addDebugInfo(`Starting camera with facing mode: ${facingMode}`)

        // Request camera with basic constraints
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode,
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        })

        // Get active track info
        const videoTrack = stream.getVideoTracks()[0]
        if (videoTrack) {
          addDebugInfo(`Active camera: ${videoTrack.label}`)
        }

        // Set up video element - IMPORTANT: Do this before setting srcObject
        if (videoRef.current) {
          // Reset video element
          videoRef.current.onloadedmetadata = null
          videoRef.current.onloadeddata = null
          videoRef.current.onerror = null

          // Set new handlers
          videoRef.current.onloadedmetadata = () => {
            addDebugInfo("Video metadata loaded")
          }

          videoRef.current.onloadeddata = () => {
            addDebugInfo("Video data loaded")
            // Start scanning once video is loaded
            startBarcodeScanning()
          }

          videoRef.current.onerror = (e) => {
            addDebugInfo(`Video error: ${e}`)
          }

          // Set stream to video element
          videoRef.current.srcObject = stream

          // Try to play
          try {
            addDebugInfo("Attempting to play video")
            await videoRef.current.play()
            addDebugInfo("Video playing successfully")
            setNeedsUserInteraction(false)
          } catch (err) {
            addDebugInfo(`Play failed: ${(err as Error).message}`)
            setNeedsUserInteraction(true)
          }
        } else {
          addDebugInfo("Video element reference not available")
        }
      } catch (error) {
        const err = error as Error
        addDebugInfo(`Camera error: ${err.name} - ${err.message}`)
        setErrorMessage(`Could not access camera: ${err.message}`)
      }
    }

    startCamera()

    // Cleanup function
    return () => {
      if (stream) {
        addDebugInfo("Stopping camera stream")
        stream.getTracks().forEach((track) => track.stop())
      }

      setIsScanning(false)
    }
  }, [isOpen, facingMode])

  // Function to start barcode scanning - now just sets up the canvas
  const startBarcodeScanning = async () => {
    if (!videoRef.current || !canvasRef.current) {
      addDebugInfo("Cannot start scanning: video or canvas ref not available")
      return
    }

    setIsScanning(false) // Set to false since we're not auto-scanning
    addDebugInfo("Manual capture mode enabled (auto-scanning disabled)")

    // Check if native BarcodeDetector is available
    if (isBarcodeDetectorSupported) {
      try {
        const formats = await (window as any).BarcodeDetector.getSupportedFormats()
        addDebugInfo(`Supported formats: ${formats.join(", ")}`)
      } catch (error) {
        addDebugInfo(`BarcodeDetector initialization error: ${(error as Error).message}`)
      }
    }
  }

  // Fallback to ZXing library for barcode scanning
  const startZXingScanning = async () => {
    addDebugInfo("Initializing ZXing barcode scanning")

    try {
      // Dynamically import ZXing
      const ZXing = await import("@zxing/library")
      const codeReader = new ZXing.BrowserMultiFormatReader()

      addDebugInfo("ZXing initialized")

      // Set up scanning interval
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current)
      }

      scanIntervalRef.current = setInterval(() => {
        if (!videoRef.current || !canvasRef.current || videoRef.current.paused || videoRef.current.ended) {
          return
        }

        try {
          // Draw the current video frame to the canvas
          const canvas = canvasRef.current
          const context = canvas.getContext("2d")

          if (!context) return

          // Set canvas dimensions to match video
          canvas.width = videoRef.current.videoWidth
          canvas.height = videoRef.current.videoHeight

          // Draw video frame to canvas
          context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height)

          // Get image data for processing
          const imageData = context.getImageData(0, 0, canvas.width, canvas.height)

          // Process with ZXing
          const hints = new Map()
          hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [
            ZXing.BarcodeFormat.EAN_13,
            ZXing.BarcodeFormat.EAN_8,
            ZXing.BarcodeFormat.CODE_39,
            ZXing.BarcodeFormat.CODE_128,
            ZXing.BarcodeFormat.UPC_A,
            ZXing.BarcodeFormat.UPC_E,
            ZXing.BarcodeFormat.QR_CODE,
            ZXing.BarcodeFormat.DATA_MATRIX,
          ])

          const luminanceSource = new ZXing.HTMLCanvasElementLuminanceSource(canvas)
          const binaryBitmap = new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(luminanceSource))

          try {
            const result = new ZXing.MultiFormatReader().decode(binaryBitmap, hints)

            if (result && result.getText()) {
              const barcode = result.getText()
              addDebugInfo(`ZXing detected barcode: ${barcode}`)

              // Only process if it's a new code
              if (barcode !== lastDetectedCode) {
                setLastDetectedCode(barcode)
                handleSuccessfulScan(barcode)
              }
            }
          } catch (error) {
            // ZXing throws errors when no barcode is found, so we ignore those
            if (!(error instanceof ZXing.NotFoundException)) {
              addDebugInfo(`ZXing error: ${(error as Error).message}`)
            }
          }
        } catch (error) {
          addDebugInfo(`Canvas processing error: ${(error as Error).message}`)
        }
      }, 500) // Check every 500ms
    } catch (error) {
      addDebugInfo(`ZXing initialization error: ${(error as Error).message}`)
      // Fall back to simple image processing
      startSimpleImageProcessing()
    }
  }

  // Fallback to simple image processing for barcode detection
  const startSimpleImageProcessing = () => {
    addDebugInfo("Using simple image processing for barcode detection")

    // Set up scanning interval
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current)
    }

    scanIntervalRef.current = setInterval(() => {
      if (!videoRef.current || !canvasRef.current || videoRef.current.paused || videoRef.current.ended) {
        return
      }

      try {
        // Draw the current video frame to the canvas
        const canvas = canvasRef.current
        const context = canvas.getContext("2d")

        if (!context) return

        // Set canvas dimensions to match video
        canvas.width = videoRef.current.videoWidth
        canvas.height = videoRef.current.videoHeight

        // Draw video frame to canvas
        context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height)

        // For simple processing, we just look for high contrast areas
        // This is a very basic approach and won't actually detect barcodes
        // In a real app, you'd use a proper barcode scanning library
      } catch (error) {
        addDebugInfo(`Image processing error: ${(error as Error).message}`)
      }
    }, 500)
  }

  // Handle successful barcode scan
  const handleSuccessfulScan = (barcode: string) => {
    // Stop scanning
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current)
      scanIntervalRef.current = null
    }

    // Play success sound
    try {
      const audio = new Audio("/sounds/beep.mp3")
      audio.play().catch((e) => console.log("Audio play failed:", e))
    } catch (e) {
      console.log("Audio play failed:", e)
    }

    // Call the callback with the detected barcode
    onBarcodeDetected(barcode)

    // Close the dialog
    setIsOpen(false)

    // Show a success toast
    toast({
      title: "Barcode detected",
      description: `Detected barcode: ${barcode}`,
    })
  }

  // Switch camera
  const switchCamera = () => {
    // Stop scanning before switching
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current)
      scanIntervalRef.current = null
    }

    setIsScanning(false)
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"))
    addDebugInfo(`Switching camera to ${facingMode === "environment" ? "user" : "environment"}`)
  }

  // Handle manual play (for browsers that require user interaction)
  const handleManualPlay = async () => {
    if (videoRef.current) {
      try {
        await videoRef.current.play()
        setNeedsUserInteraction(false)
        addDebugInfo("Video played after user interaction")
        startBarcodeScanning()
      } catch (err) {
        addDebugInfo(`Manual play failed: ${(err as Error).message}`)
      }
    }
  }

  // Manual capture button handler
  const handleManualCapture = () => {
    if (!videoRef.current || !canvasRef.current) {
      addDebugInfo("Cannot capture: video or canvas ref not available")
      return
    }

    addDebugInfo("Manual capture initiated")

    try {
      // Draw the current video frame to the canvas
      const canvas = canvasRef.current
      const context = canvas.getContext("2d")

      if (!context) return

      // Set canvas dimensions to match video
      canvas.width = videoRef.current.videoWidth
      canvas.height = videoRef.current.videoHeight

      // Draw video frame to canvas
      context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height)

      // Try to detect barcode with BarcodeDetector if available
      if (isBarcodeDetectorSupported) {
        const barcodeDetector = new (window as any).BarcodeDetector({
          formats: ["ean_13", "ean_8", "code_39", "code_128", "qr_code", "data_matrix", "upc_a", "upc_e"],
        })

        barcodeDetector
          .detect(canvas)
          .then((barcodes: any[]) => {
            if (barcodes.length > 0) {
              // Get the first detected barcode
              const barcode = barcodes[0]
              addDebugInfo(`Manual capture detected: ${barcode.rawValue}`)
              handleSuccessfulScan(barcode.rawValue)
            } else {
              addDebugInfo("No barcode found in manual capture")
              toast({
                title: "No barcode detected",
                description: "Try adjusting the position or lighting",
                variant: "destructive",
              })
            }
          })
          .catch((error: Error) => {
            addDebugInfo(`Manual detection error: ${error.message}`)
            // Fallback to ZXing if available
            detectWithZXing(canvas)
          })
      } else {
        // If BarcodeDetector is not available, try ZXing
        detectWithZXing(canvas)
      }
    } catch (error) {
      addDebugInfo(`Manual capture error: ${(error as Error).message}`)
      toast({
        title: "Capture failed",
        description: "Please try again",
        variant: "destructive",
      })
    }
  }

  // Helper function to detect with ZXing
  const detectWithZXing = async (canvas: HTMLCanvasElement) => {
    try {
      // Dynamically import ZXing
      const ZXing = await import("@zxing/library")

      const luminanceSource = new ZXing.HTMLCanvasElementLuminanceSource(canvas)
      const binaryBitmap = new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(luminanceSource))

      const hints = new Map()
      hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [
        ZXing.BarcodeFormat.EAN_13,
        ZXing.BarcodeFormat.EAN_8,
        ZXing.BarcodeFormat.CODE_39,
        ZXing.BarcodeFormat.CODE_128,
        ZXing.BarcodeFormat.UPC_A,
        ZXing.BarcodeFormat.UPC_E,
        ZXing.BarcodeFormat.QR_CODE,
        ZXing.BarcodeFormat.DATA_MATRIX,
      ])

      try {
        const result = new ZXing.MultiFormatReader().decode(binaryBitmap, hints)

        if (result && result.getText()) {
          const barcode = result.getText()
          addDebugInfo(`ZXing detected barcode: ${barcode}`)
          handleSuccessfulScan(barcode)
        } else {
          addDebugInfo("ZXing could not detect a barcode")
          toast({
            title: "No barcode detected",
            description: "Try adjusting the position or lighting",
            variant: "destructive",
          })
        }
      } catch (error) {
        addDebugInfo(`ZXing decode error: ${(error as Error).message}`)
        toast({
          title: "No barcode detected",
          description: "Try adjusting the position or lighting",
          variant: "destructive",
        })
      }
    } catch (error) {
      addDebugInfo(`ZXing import error: ${(error as Error).message}`)
      // If all else fails, show a message
      toast({
        title: "Barcode detection failed",
        description: "Your device may not support barcode scanning",
        variant: "destructive",
      })
    }
  }

  // Simulate a barcode scan (fallback for testing)
  const simulateScan = () => {
    const randomBarcode = Math.floor(Math.random() * 1000000000000)
      .toString()
      .padStart(12, "0")
    addDebugInfo(`Simulating barcode scan: ${randomBarcode}`)
    handleSuccessfulScan(randomBarcode)
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
            <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
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
          if (!open) {
            // Clean up when dialog closes
            if (scanIntervalRef.current) {
              clearInterval(scanIntervalRef.current)
              scanIntervalRef.current = null
            }
            setIsScanning(false)
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Camera Scanner</DialogTitle>
          </DialogHeader>

          {errorMessage ? (
            <div className="p-6 flex flex-col items-center justify-center gap-4">
              <AlertTriangle className="h-12 w-12 text-amber-500" />
              <h3 className="text-lg font-semibold">Camera Access Issue</h3>
              <p className="text-center text-muted-foreground">{errorMessage}</p>
              <Button onClick={() => setErrorMessage(null)}>Retry Camera Access</Button>
            </div>
          ) : (
            <>
              <div className="relative aspect-video bg-black rounded-md overflow-hidden">
                {/* Video element - using inline styles for maximum compatibility */}
                <video
                  ref={videoRef}
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    transform: facingMode === "user" ? "scaleX(-1)" : "none",
                    backgroundColor: "black",
                  }}
                  playsInline
                  muted
                  autoPlay
                />

                {/* Hidden canvas for image processing */}
                <canvas
                  ref={canvasRef}
                  style={{
                    display: "none",
                    position: "absolute",
                    pointerEvents: "none",
                  }}
                />

                {/* Scanning overlay */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    pointerEvents: "none",
                  }}
                >
                  <div
                    style={{
                      width: "80%",
                      height: "25%",
                      border: "2px solid white",
                      borderRadius: "4px",
                      opacity: 0.7,
                      position: "relative",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        left: 0,
                        right: 0,
                        top: "50%",
                        height: "2px",
                        backgroundColor: "rgba(255, 255, 255, 0.7)",
                        boxShadow: "0 0 8px rgba(255, 255, 255, 0.8)",
                        animation: "pulse 1.5s infinite",
                      }}
                    ></div>
                  </div>
                </div>

                {/* Replace the scanning indicator with a manual mode indicator */}
                <div
                  style={{
                    position: "absolute",
                    top: "10px",
                    right: "10px",
                    backgroundColor: "rgba(0, 0, 0, 0.5)",
                    color: "white",
                    padding: "4px 8px",
                    borderRadius: "4px",
                    fontSize: "12px",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <Camera className="h-3 w-3 mr-1" />
                  Manual Mode
                </div>

                {/* Play button for browsers that require user interaction */}
                {needsUserInteraction && (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: "rgba(0, 0, 0, 0.7)",
                    }}
                  >
                    <Button onClick={handleManualPlay}>
                      <Play className="h-4 w-4 mr-2" />
                      Tap to Start Camera
                    </Button>
                  </div>
                )}
              </div>

              <p className="text-sm text-center text-muted-foreground">
                Position the barcode within the frame and tap "Capture" when ready
              </p>

              <DialogFooter className="flex flex-col sm:flex-row gap-2 justify-between">
                <Button variant="outline" onClick={() => setIsOpen(false)}>
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>

                <div className="flex gap-2">
                  <Button variant="outline" onClick={switchCamera}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Switch Camera ({facingMode === "environment" ? "Front" : "Back"})
                  </Button>

                  <Button onClick={handleManualCapture}>
                    <Camera className="h-4 w-4 mr-2" />
                    Capture
                  </Button>
                </div>
              </DialogFooter>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDebugInfo(!showDebugInfo)}
                className="mt-2 mx-auto"
              >
                <Info className="h-4 w-4 mr-2" />
                {showDebugInfo ? "Hide Debug Info" : "Show Debug Info"}
              </Button>

              {showDebugInfo && (
                <div className="mt-2 p-3 bg-muted rounded-md w-full">
                  <h4 className="font-semibold text-sm mb-2">Debug Information:</h4>
                  <div className="text-xs space-y-1 font-mono max-h-40 overflow-y-auto">
                    <div>• Browser: {navigator.userAgent}</div>
                    <div>• Facing mode: {facingMode}</div>
                    <div>• BarcodeDetector API: {isBarcodeDetectorSupported ? "Supported" : "Not supported"}</div>
                    <div>• Video element: {videoRef.current ? "Available" : "Not available"}</div>
                    <div>• Video playing: {videoRef.current?.paused === false ? "Yes" : "No"}</div>
                    <div>
                      • Video dimensions: {videoRef.current?.videoWidth || 0}x{videoRef.current?.videoHeight || 0}
                    </div>
                    <div>• Mode: Manual capture only</div>
                    <div>• Last detected code: {lastDetectedCode || "None"}</div>
                    {debugInfo.map((info, i) => (
                      <div key={i}>{info}</div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Add global styles for animations */}
      <style jsx global>{`
        @keyframes pulse {
          0% { opacity: 0.4; }
          50% { opacity: 1; }
          100% { opacity: 0.4; }
        }
      `}</style>
    </>
  )
}

