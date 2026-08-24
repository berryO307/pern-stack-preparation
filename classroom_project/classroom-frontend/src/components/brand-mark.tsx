import { University } from "lucide-react";

// Single swappable source for the product's mark - sidebar header, favicon,
// OG image, and login page all consume this one component, so a real SVG
// asset can replace the lucide fallback later without touching any of them.
// currentColor means it inherits whatever foreground color surrounds it
// (the sidebar's, the login page's) rather than a hardcoded token.
type BrandMarkProps = {
  className?: string;
};

export function BrandMark({ className }: BrandMarkProps) {
  return (
    <div
      role="img"
      aria-label="Academic Hub"
      className={
        "grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary " +
        (className ?? "")
      }
    >
      <University className="size-5" style={{ color: "currentColor" }} />
    </div>
  );
}

BrandMark.displayName = "BrandMark";
