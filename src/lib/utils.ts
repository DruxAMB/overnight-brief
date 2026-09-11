// Minimal cn utility: no clsx dependency needed for this project.
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}
