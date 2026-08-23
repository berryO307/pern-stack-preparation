import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar.tsx";
import { getInitials } from "@/lib/utils.ts";
import { cn } from "@/lib/utils.ts";

type PersonCellProps = {
  name: string;
  avatarSrc?: string;
  className?: string;
};

// Shared identity cell (avatar + name) for anywhere a person shows up in a
// table row - Faculty's Name column and Classes' Teacher column both use
// this rather than each keeping their own copy. No handle/email line here:
// Faculty explicitly dropped its @handle display earlier, so this only ever
// renders a name, matching what's actually shipped rather than a hypothetical.
export function PersonCell({ name, avatarSrc, className }: PersonCellProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Avatar className="h-8 w-8">
        {avatarSrc && (
          <AvatarImage src={avatarSrc} alt="" loading="lazy" width={80} height={80} />
        )}
        <AvatarFallback>{getInitials(name)}</AvatarFallback>
      </Avatar>
      <span className="truncate font-medium text-foreground">{name}</span>
    </div>
  );
}
