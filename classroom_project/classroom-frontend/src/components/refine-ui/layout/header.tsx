import { useLink, useRefineOptions } from "@refinedev/core";
import { ThemeToggle } from "@/components/refine-ui/theme/theme-toggle";
import { useSidebar, SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

// Search lives in the sidebar (compact search row) and sign-out lives in the
// sidebar's footer user menu, but the theme toggle gets its own persistent
// top-right spot on every page - buried inside the footer user menu, it was
// easy to miss (had to open that menu just to find it). The mobile header
// already existed for the sidebar-sheet trigger; it keeps the toggle too.
export const Header = () => {
  const { isMobile } = useSidebar();

  return isMobile ? <MobileHeader /> : <DesktopHeader />;
};

function DesktopHeader() {
  // h-16 matches the sidebar's own header row (logo + trigger) exactly, so
  // the two sit flush against each other instead of this bar reading a
  // visibly different height where they meet.
  return (
    <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center justify-end border-b border-border bg-sidebar px-4">
      <ThemeToggle className="h-8 w-8" />
    </header>
  );
}

function MobileHeader() {
  const { open, isMobile, setOpenMobile } = useSidebar();

  const { title } = useRefineOptions();
  const Link = useLink();

  return (
    <header
      className={cn(
        "sticky",
        "top-0",
        "flex",
        "h-12",
        "shrink-0",
        "items-center",
        "gap-2",
        "border-b",
        "border-border",
        "bg-sidebar",
        "pr-3",
        "justify-between",
        "z-40"
      )}
    >
      <SidebarTrigger
        className={cn("text-muted-foreground", "rotate-180", "ml-1", {
          "opacity-0": open,
          "opacity-100": !open || isMobile,
          "pointer-events-auto": !open || isMobile,
          "pointer-events-none": open && !isMobile,
        })}
      />

      <Link
        to="/"
        onClick={() => isMobile && setOpenMobile(false)}
        className={cn(
          "whitespace-nowrap",
          "flex",
          "flex-row",
          "h-full",
          "items-center",
          "justify-start",
          "gap-2",
          "transition-discrete",
          "duration-200",
          {
            "pl-3": !open,
            "pl-5": open,
          }
        )}
      >
        <div>{title.icon}</div>
        <h2
          className={cn(
            "text-sm",
            "font-bold",
            "transition-opacity",
            "duration-200",
            {
              "opacity-0": !open,
              "opacity-100": open,
            }
          )}
        >
          {title.text}
        </h2>
      </Link>

      <ThemeToggle className={cn("h-8", "w-8")} />
    </header>
  );
}

Header.displayName = "Header";
MobileHeader.displayName = "MobileHeader";
DesktopHeader.displayName = "DesktopHeader";
