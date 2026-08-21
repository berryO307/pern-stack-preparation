import { useEffect } from "react";
import { useCustom, type HttpError } from "@refinedev/core";
import { BACKEND_BASE_URL } from "@/constants";
import { reportRumError } from "@/lib/rum.ts";
import type { DashboardSummary } from "@/types";

export function useDashboardSummary(departmentId?: number) {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const { query } = useCustom<DashboardSummary, HttpError>({
    url: `${BACKEND_BASE_URL}dashboard/summary`,
    method: "get",
    config: {
      query: {
        tz: timeZone,
        ...(departmentId ? { department: departmentId } : {}),
      },
    },
    queryOptions: {
      // Keep the last good payload on screen while a background refetch runs
      // (e.g. after a 429) instead of blanking the dashboard.
      placeholderData: (previous) => previous,
    },
  });

  // Distinguishes throttling from real failures in RUM the way the spec
  // asks — status code included since captureException only takes an Error,
  // no separate metadata argument (see lib/rum.ts).
  useEffect(() => {
    if (query.error) {
      reportRumError(
        `Dashboard summary fetch failed: ${query.error.statusCode ?? "unknown"} ${query.error.message}`,
      );
    }
  }, [query.error]);

  return query;
}
