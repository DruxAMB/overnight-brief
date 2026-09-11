import { cn } from "@/lib/utils";

/** Card surface: Ground Iron (#181818), 8px radius, Circuit Border hairline, no shadow. */
export function Card({ children, className, as: As = "div" }: { children: React.ReactNode; className?: string; as?: React.ElementType }) {
  return (
    <As
      className={cn(
        "rounded-lg border border-border bg-card text-card-foreground p-4 sm:p-6",
        className,
      )}
    >
      {children}
    </As>
  );
}

/** Badge: status pill. Modal uses green palette, no blue/purple. */
export function Badge({ children, variant = "default", className }: { children: React.ReactNode; variant?: "default" | "success" | "warning" | "destructive" | "info"; className?: string }) {
  const variantClass = {
    default: "bg-muted text-muted-foreground border border-border",
    success: "bg-success/15 text-success border border-success/30",
    warning: "bg-warning/15 text-warning border border-warning/30",
    destructive: "bg-destructive/15 text-destructive border border-destructive/30",
    info: "bg-info/15 text-info border border-info/30",
  }[variant];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", variantClass, className)}>
      {children}
    </span>
  );
}

/** Button: Modal's component specs.
 *  Primary = Lime Pulse pill (rationed: one per viewport).
 *  Secondary = Ground Iron fill with Phosphor White border.
 *  Ghost = transparent with Circuit Border. */
export function Button({ children, variant = "primary", size = "md", className, disabled, ...props }: {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "destructive";
  size?: "sm" | "md" | "lg";
  className?: string;
  disabled?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const variantClass = {
    // Accent Pill: Lime Pulse fill, dark text, full pill radius
    primary: "bg-primary text-primary-foreground rounded-full hover:bg-primary/90",
    // Primary Filled: Ground Iron fill, Phosphor White text + border
    secondary: "bg-card text-foreground border border-foreground rounded-lg hover:bg-muted",
    // Ghost Outline: transparent, Circuit Border, Fern Link text
    ghost: "text-muted-foreground border border-border rounded-lg hover:bg-muted",
    destructive: "bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90",
  }[variant];
  const sizeClass = {
    sm: "h-9 px-3 text-sm",
    md: "h-11 px-5 text-sm",
    lg: "h-12 px-6 text-base",
  }[size];
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 font-medium transition-colors",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        "disabled:opacity-50 disabled:pointer-events-none",
        variantClass,
        sizeClass,
        className,
      )}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}

/** Skeleton: loading placeholder matching Ground Iron surface. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-muted", className)} />;
}

/** Empty state: Sage 60 text on void canvas. */
export function EmptyState({ icon, title, description, action }: { icon?: React.ReactNode; title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      {icon && <div className="text-muted-foreground" aria-hidden="true">{icon}</div>}
      <div>
        <p className="font-medium text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
