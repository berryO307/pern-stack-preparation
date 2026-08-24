import { useEffect, useState } from "react";
import { useLink, useNavigation } from "@refinedev/core";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { PersonCell } from "@/components/person-cell.tsx";
import { buildAvatarSrc } from "@/lib/cloudinary.ts";
import type { PersonSummary } from "@/types";

const PAGE_SIZE = 10;

// Teachers/Students both need this exact shape (name-is-the-link, Role
// badge, deduped, capped at 10 with View more), so it's one component
// parameterised by which resource the name links to and what the constant
// Role label reads - not two near-identical copies.
type PeopleTableSectionProps = {
  title: string;
  people: PersonSummary[];
  isLoading: boolean;
  roleLabel: string;
  linkResource: "faculty" | "users";
  emptyMessage: string;
  resetKey: string | number | undefined;
};

export function PeopleTableSection({
  title,
  people,
  isLoading,
  roleLabel,
  linkResource,
  emptyMessage,
  resetKey,
}: PeopleTableSectionProps) {
  const { showUrl } = useNavigation();
  const Link = useLink();

  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  useEffect(() => setVisibleCount(PAGE_SIZE), [resetKey]);

  const visible = people.slice(0, visibleCount);
  const remaining = Math.max(people.length - visible.length, 0);

  return (
    <div className="space-y-2">
      <p className="text-lg font-semibold">
        {title} (<span className="tabular-nums">{people.length}</span>)
      </p>

      {isLoading ? (
        <div className="mt-4 space-y-2 rounded-lg border p-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : people.length === 0 ? (
        <div className="mt-4 flex items-center justify-center rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        </div>
      ) : (
        <div className="mt-4 overflow-hidden rounded-lg border">
          <div className="overflow-x-auto">
            <Table>
              <TableCaption className="sr-only">{title}</TableCaption>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead scope="col">Name</TableHead>
                  <TableHead scope="col">Role</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((person, index) => (
                  <TableRow key={person.id} className={index % 2 === 1 ? "bg-muted/30" : undefined}>
                    <TableCell>
                      <Link to={showUrl(linkResource, person.id)} className="inline-block">
                        <PersonCell
                          name={person.name}
                          avatarSrc={buildAvatarSrc(person.imageCldPubId, person.image)}
                        />
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{roleLabel}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {remaining > 0 && (
        <div className="mt-3 flex justify-center">
          <Button variant="outline" onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}>
            View more ({remaining})
          </Button>
        </div>
      )}
    </div>
  );
}
