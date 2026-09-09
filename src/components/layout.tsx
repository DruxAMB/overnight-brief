import { cn } from "@/lib/utils";

/** Full-height page shell with max-width container. */
export function PageShell({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("min-h-[100dvh] flex flex-col bg-background", className)}>
      {children}
    </div>
  );
}

/** Centered container with responsive padding. */
export function Container({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8", className)}>
      {children}
    </div>
  );
}

/** Vertical stack with consistent gap. */
export function Stack({ children, className, gap = "md" }: { children: React.ReactNode; className?: string; gap?: "sm" | "md" | "lg" }) {
  const gapClass = gap === "sm" ? "gap-2" : gap === "lg" ? "gap-6" : "gap-4";
  return <div className={cn("flex flex-col", gapClass, className)}>{children}</div>;
}

/** Horizontal grid with responsive columns. */
export function Grid({ children, className, cols = 1 }: { children: React.ReactNode; className?: string; cols?: 1 | 2 | 3 }) {
  const colsClass = cols === 2 ? "sm:grid-cols-2" : cols === 3 ? "sm:grid-cols-2 lg:grid-cols-3" : "grid-cols-1";
  return <div className={cn("grid gap-4", colsClass, className)}>{children}</div>;
}
