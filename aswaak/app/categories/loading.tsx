export default function Loading() {
    return (
      <div className="container py-6 max-w-4xl">
        <div className="flex justify-between items-center mb-6">
          <div>
            <div className="h-8 w-48 bg-muted rounded animate-pulse mb-2"></div>
            <div className="h-4 w-64 bg-muted rounded animate-pulse"></div>
          </div>
        </div>
  
        <div className="rounded-md border">
          <div className="p-6 space-y-4">
            <div className="flex justify-between">
              <div className="h-10 w-64 bg-muted rounded animate-pulse"></div>
              <div className="h-10 w-32 bg-muted rounded animate-pulse"></div>
            </div>
  
            <div className="h-[400px] w-full bg-muted rounded animate-pulse"></div>
          </div>
        </div>
      </div>
    )
  }
  
  