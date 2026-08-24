import { useEffect, useState } from "react";
import { useInvalidate, useLink, useList, useNavigation } from "@refinedev/core";
import type { CrudFilter } from "@refinedev/core";
import { BookOpen } from "lucide-react";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table.tsx";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { CreateButton } from "@/components/refine-ui/buttons/create.tsx";
import { ClassStatusBadge } from "@/components/class-status-badge.tsx";
import { buildClassBannerThumbUrl } from "@/lib/cloudinary.ts";
import { SUBJECT_TINT_AVATAR_CLASSES, hashToTintIndex } from "@/lib/subject-tint.ts";
import { Loader2 } from "lucide-react";
import type { Class } from "@/types";

const PAGE_SIZE = 10;

// Presentation-only twin of /classes' own DataTable columns (banner, class
// name, subject, teacher, status, capacity) - not the same component, since
// /classes' table is a full useTable+DataTable list view (URL-synced
// pagination/sorting/filtering) that isn't embeddable inside a page section.
// This is the roster-style pattern from classes/show.tsx instead: useList +
// manual page accumulation + View more, capped at 10 rows in the DOM.
type ClassesTableSectionProps = {
  filters: CrudFilter[];
  /** Changing this resets pagination back to page 1 - pass the subject/department id. */
  resetKey: string | number | undefined;
  enabled: boolean;
};

export function ClassesTableSection({ filters, resetKey, enabled }: ClassesTableSectionProps) {
  const { showUrl } = useNavigation();
  const Link = useLink();

  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Class[]>([]);

  useEffect(() => {
    setPage(1);
    setRows([]);
  }, [resetKey]);

  const { query } = useList<Class>({
    resource: "classes",
    filters,
    pagination: { currentPage: page, pageSize: PAGE_SIZE },
    queryOptions: { enabled },
  });

  useEffect(() => {
    const data = query.data?.data;
    if (!data) return;
    setRows((prev) => {
      if (page === 1) return data;
      const seen = new Set(prev.map((c) => c.id));
      return [...prev, ...data.filter((c) => !seen.has(c.id))];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.dataUpdatedAt]);

  const total = query.data?.total ?? 0;
  const remaining = Math.max(total - rows.length, 0);
  const hasMore = remaining > 0;
  const isInitialLoading = query.isLoading && rows.length === 0;

  return (
    <div className="space-y-2">
      <p className="text-lg font-semibold">
        Classes (<span className="tabular-nums">{total}</span>)
      </p>

      {isInitialLoading ? (
        <div className="mt-4 space-y-2 rounded-lg border p-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-4 flex flex-col items-center gap-3 rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">No classes yet.</p>
          <CreateButton resource="classes" variant="default" size="sm">
            Create a class
          </CreateButton>
        </div>
      ) : (
        <div className="mt-4 overflow-hidden rounded-lg border">
          <div className="overflow-x-auto">
            <Table>
              <TableCaption className="sr-only">Classes</TableCaption>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead scope="col" className="w-16">Banner</TableHead>
                  <TableHead scope="col">Class name</TableHead>
                  <TableHead scope="col">Subject</TableHead>
                  <TableHead scope="col">Teacher</TableHead>
                  <TableHead scope="col">Status</TableHead>
                  <TableHead scope="col" className="text-right">Capacity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((cls, index) => {
                  const src = cls.bannerCldPubId
                    ? buildClassBannerThumbUrl(cls.bannerCldPubId)
                    : cls.bannerUrl || (cls.subject?.imageCldPubId
                        ? buildClassBannerThumbUrl(cls.subject.imageCldPubId)
                        : undefined);
                  const tintIndex = hashToTintIndex(cls.subject?.id ?? cls.id);
                  return (
                    <TableRow key={cls.id} className={index % 2 === 1 ? "bg-muted/30" : undefined}>
                      <TableCell>
                        <Avatar className="h-9 w-9">
                          {src && <AvatarImage src={src} alt="" loading="lazy" width={72} height={72} />}
                          <AvatarFallback className={SUBJECT_TINT_AVATAR_CLASSES[tintIndex]}>
                            <BookOpen className="h-4 w-4" />
                          </AvatarFallback>
                        </Avatar>
                      </TableCell>
                      <TableCell>
                        <Link
                          to={showUrl("classes", cls.id)}
                          title={cls.name}
                          className="inline-block max-w-[220px] truncate rounded px-1 py-0.5 -mx-1 font-medium text-foreground hover:text-primary hover:underline focus-visible:text-primary focus-visible:underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {cls.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">{cls.subject?.name ?? "—"}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">{cls.teacher?.name ?? "—"}</span>
                      </TableCell>
                      <TableCell>
                        <ClassStatusBadge status={cls.status} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {cls.enrolledCount ?? 0}/{cls.capacity}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {hasMore && (
        <div className="mt-3 flex justify-center">
          <Button variant="outline" disabled={query.isFetching} onClick={() => setPage((p) => p + 1)}>
            {query.isFetching ? (
              <span className="flex items-center gap-2">
                Loading...
                <Loader2 className="h-4 w-4 animate-spin" />
              </span>
            ) : (
              `View more (${remaining})`
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

// Exposed so a page's own Refresh button can invalidate this section too -
// "classes" is a plain resource-list invalidation, no per-instance key
// needed since filters differ by query params, not by resource identity.
export function useInvalidateClassesTableSection() {
  const invalidate = useInvalidate();
  return () => invalidate({ resource: "classes", invalidates: ["list"] });
}
