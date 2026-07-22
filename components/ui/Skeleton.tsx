import { cn } from "@/lib/utils";

type SkeletonProps = {
  className?: string;
};

export function Skeleton({ className }: SkeletonProps) {
  return <div className={cn("skeleton rounded-xl", className)} />;
}

export function CatalogGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5 lg:gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-3">
          <Skeleton className="aspect-[4/3] w-full" />
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
    </div>
  );
}

export function PdfViewerSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="aspect-[3/4] sm:aspect-video w-full" />
      <div className="flex flex-col sm:flex-row gap-3">
        <Skeleton className="h-12 flex-1" />
        <Skeleton className="h-12 flex-1" />
      </div>
    </div>
  );
}
