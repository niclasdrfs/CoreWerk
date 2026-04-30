import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function CalendarSkeleton() {
  return (
    <div className="space-y-4 p-4">
      {/* Header row */}
      <div className="flex gap-2 justify-between">
        {[...Array(7)].map((_, i) => (
          <Skeleton key={i} className="h-8 flex-1" />
        ))}
      </div>
      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-2">
        {[...Array(35)].map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export function WeekViewSkeleton() {
  return (
    <div className="space-y-4 p-4">
      {/* Day headers */}
      <div className="flex gap-2">
        {[...Array(7)].map((_, i) => (
          <div key={i} className="flex-1 space-y-2">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-32 w-full rounded-lg" />
            <Skeleton className="h-20 w-full rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function CardSkeleton() {
  return (
    <Card>
      <CardHeader className="space-y-2">
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-4 w-2/3" />
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-12 w-full" />
      </CardContent>
    </Card>
  );
}

export function SidebarSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-1">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function HeaderSkeleton() {
  return (
    <header className="flex items-center justify-between px-4 py-3 border-b bg-card">
      <Skeleton className="h-10 w-10 rounded-lg" />
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-10 w-10 rounded-lg" />
    </header>
  );
}

export function PageLoadingSkeleton() {
  return (
    <div className="h-screen flex flex-col bg-background">
      <HeaderSkeleton />
      <div className="flex-1 p-4">
        <WeekViewSkeleton />
      </div>
    </div>
  );
}
