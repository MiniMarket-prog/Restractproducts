declare module "quagga" {
    interface QuaggaInitConfig {
      inputStream: {
        name?: string
        type: string
        target: HTMLElement | string
        constraints?: {
          width?: number | { min: number; max?: number }
          height?: number | { min: number; max?: number }
          aspectRatio?: { min: number; max: number }
          facingMode?: "environment" | "user"
          deviceId?: string
        }
        area?: {
          top?: string | number
          right?: string | number
          left?: string | number
          bottom?: string | number
        }
        singleChannel?: boolean
      }
      locator?: {
        patchSize?: "x-small" | "small" | "medium" | "large" | "x-large"
        halfSample?: boolean
      }
      numOfWorkers?: number
      frequency?: number
      decoder?: {
        readers?: string[]
        debug?: boolean
        multiple?: boolean
      }
      locate?: boolean
    }
  
    interface QuaggaResult {
      codeResult: {
        code: string
        format: string
        start: number
        end: number
        codeset: number
        startInfo: {
          error: number
          code: number
          start: number
          end: number
        }
        decodedCodes: {
          code: number
          start: number
          end: number
        }[]
        endInfo: {
          error: number
          code: number
          start: number
          end: number
        }
        direction: number
      }
      line: {
        x: number
        y: number
      }[]
      angle: number
      pattern: number[]
      box: [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }, { x: number; y: number }]
      boxes: [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }, { x: number; y: number }][]
    }
  
    interface QuaggaStatic {
      init(config: QuaggaInitConfig, callback?: (err: Error | null) => void): Promise<void>
      start(): void
      stop(): void
      onDetected(callback: (result: QuaggaResult) => void): void
      offDetected(callback: (result: QuaggaResult) => void): void
      onProcessed(callback: (result: QuaggaResult) => void): void
      offProcessed(callback: (result: QuaggaResult) => void): void
      decodeSingle(config: QuaggaInitConfig, callback: (result: QuaggaResult) => void): void
      registerResultCollector(callback: (result: QuaggaResult) => void): void
      setReaders(readers: string[]): void
    }
  
    const Quagga: QuaggaStatic
    export default Quagga
  }
  
  