import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar.tsx";
import { getInitials, displayName as getDisplayName } from "@/lib/utils.ts";
import { cn } from "@/lib/utils.ts";

type PersonCellProps = {
  name: string | null | undefined;
  // Optional: only used as the fallback when `name` is empty (a GitHub
  // sign-in with no display name set - see lib/auth.ts on the backend).
  // Existing callers that don't pass it keep the same behavior as before.
  email?: string | null;
  avatarSrc?: string;
  className?: string;
};

// Shared identity cell (avatar + name) for anywhere a person shows up in a
// table row - Faculty's Name column and Classes' Teacher column both use
// this rather than each keeping their own copy. No handle/email line here:
// Faculty explicitly dropped its @handle display earlier, so this only ever
// renders a name, matching what's actually shipped rather than a hypothetical.
export function PersonCell({ name, email, avatarSrc, className }: PersonCellProps) {
  const resolvedName = getDisplayName({ name, email });
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Avatar className="h-8 w-8">
        {avatarSrc && (
          <AvatarImage src={avatarSrc} alt="" loading="lazy" width={80} height={80} />
        )}
        <AvatarFallback>{getInitials(resolvedName)}</AvatarFallback>
      </Avatar>
      <span className="truncate font-medium text-foreground">{resolvedName}</span>
    </div>
  );
}
