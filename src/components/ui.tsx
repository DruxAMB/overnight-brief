import { cn } from "@/lib/utils";

/** Card surface — uses --card and --border tokens. */
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

/** Badge — status pill using semantic tokens. */
export function Badge({ children, variant = "default", className }: { children: React.ReactNode; variant?: "default" | "success" | "warning" | "destructive" | "info"; className?: string }) {
  const variantClass = {
    default: "bg-muted text-muted-foreground",
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

/** Button — primary/secondary/ghost/destructive, one size scale. */
export function Button({ children, variant = "primary", size = "md", className, disabled, ...props }: {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "destructive";
  size?: "sm" | "md" | "lg";
  className?: string;
  disabled?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const variantClass = {
    primary: "bg-primary text-primary-foreground hover:bg-primary/90",
    secondary: "bg-secondary text-secondary-foreground border border-border hover:bg-secondary/80",
    ghost: "text-foreground hover:bg-muted",
    destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
  }[variant];
  const sizeClass = {
    sm: "h-9 px-3 text-sm",
    md: "h-11 px-5 text-sm",
    lg: "h-12 px-6 text-base",
  }[size];
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors",
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

/** Skeleton — loading placeholder matching real layout. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} />;
}

/** Empty state — explains what will appear and offers the action. */
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
