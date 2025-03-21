interface BarcodeDetectorOptions {
    formats?: string[]
  }
  
  interface BarcodeDetector {
    detect(image: ImageBitmapSource): Promise<Array<DetectedBarcode>>
  }
  
  interface DetectedBarcode {
    boundingBox: DOMRectReadOnly
    cornerPoints: Array<{ x: number; y: number }>
    format: string
    rawValue: string
  }
  
  interface BarcodeDetectorConstructor {
    new (options?: BarcodeDetectorOptions): BarcodeDetector
    getSupportedFormats(): Promise<Array<string>>
  }
  
  interface Window {
    BarcodeDetector?: BarcodeDetectorConstructor
  }
  
  