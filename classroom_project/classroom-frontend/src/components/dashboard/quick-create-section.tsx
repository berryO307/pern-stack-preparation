import { useEffect, useState } from "react";
import { useGetIdentity } from "@refinedev/core";
import { useNavigate } from "react-router";
import { BookPlus, CalendarPlus, MoreVertical, UserPlus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Separator } from "@/components/ui/separator.tsx";
import { cn } from "@/lib/utils.ts";

type Identity = { id: string };

const STORAGE_PREFIX = "dashboard.quickCreate.hidden.";

const CARDS = [
  {
    key: "subject",
    title: "Add subject",
    description: "Create one manually or import from CSV",
    icon: BookPlus,
    to: "/subjects/create",
  },
  {
    key: "class",
    title: "Add class",
    description: "Create one manually or import from CSV",
    icon: CalendarPlus,
    to: "/classes/create",
  },
  {
    key: "enroll",
    title: "Enroll students",
    description: "Assign students to a class roster",
    icon: UserPlus,
    to: "/enrollments/create",
  },
] as const;

export function QuickCreateSection() {
  const { data: identity } = useGetIdentity<Identity>();
  const navigate = useNavigate();
  const [hidden, setHidden] = useState<boolean | null>(null);

  useEffect(() => {
    if (!identity?.id) return;
    setHidden(localStorage.getItem(STORAGE_PREFIX + identity.id) === "1");
  }, [identity?.id]);

  const setPreference = (next: boolean) => {
    if (!identity?.id) return;
    localStorage.setItem(STORAGE_PREFIX + identity.id, next ? "1" : "0");
    setHidden(next);
  };

  // Identity hasn't resolved yet - nothing to key the preference on, so
  // render nothing rather than flash the wrong state.
  if (hidden === null) return null;

  return (
    <div className="space-y-4">
      {/* Header - and its toggle - always stays mounted, whether the cards
          below are expanded or collapsed. That's what makes this reversible
          from both directions: the kebab's own label flips between Hide/Show,
          and there's a plain-text Show button right beside it once hidden. */}
      <div className="flex items-center justify-between">
        <h2
          className={cn(
            "font-semibold",
            hidden ? "text-sm text-muted-foreground" : "text-lg",
          )}
        >
          Quick actions
        </h2>
        <div className="flex items-center gap-1">
          {hidden && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPreference(false)}
              aria-label="Show quick actions"
            >
              Show
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Section options">
                <MoreVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setPreference(!hidden)}>
                {hidden ? "Show this section" : "Hide this section"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-in-out motion-reduce:transition-none",
          hidden ? "grid-rows-[0fr]" : "grid-rows-[1fr]",
        )}
      >
        <div className="overflow-hidden">
          <div className="space-y-4 pb-0.5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {CARDS.map(({ key, title, description, icon: Icon, to }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => navigate(to)}
                  className={cn(
                    "flex items-start gap-3 rounded-lg border p-4 text-left transition-colors",
                    "hover:border-primary/40 hover:bg-accent/40",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  )}
                >
                  <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{title}</p>
                    <p className="text-xs text-muted-foreground">{description}</p>
                  </div>
                </button>
              ))}
            </div>

            <Separator />
          </div>
        </div>
      </div>
    </div>
  );
}

QuickCreateSection.displayName = "QuickCreateSection";
