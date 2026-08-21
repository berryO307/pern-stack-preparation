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

  const hide = () => {
    if (!identity?.id) return;
    localStorage.setItem(STORAGE_PREFIX + identity.id, "1");
    setHidden(true);
  };

  if (hidden !== false) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Start creating content</h2>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Section options">
              <MoreVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={hide}>Hide this section</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

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
  );
}

QuickCreateSection.displayName = "QuickCreateSection";
