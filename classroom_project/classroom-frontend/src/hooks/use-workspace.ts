import { useCustom, type HttpError } from "@refinedev/core";
import { BACKEND_BASE_URL } from "@/constants";

export type Workspace = {
  id: string;
  expiresAt: string;
  isPermanent: boolean;
  wasJustProvisioned: boolean;
};

// POST /api/demo/workspace is idempotent server-side - a repeat call is
// always safe - but there's no reason for the client to make repeat calls
// in the first place. staleTime: Infinity plus disabling the standard
// refetch-on-mount/focus/reconnect triggers means React Query treats the
// first successful response as good until something in this app EXPLICITLY
// asks for a fresh one (WorkspaceBanner's own refetch() when the countdown
// hits zero) - a second mount of this hook, a StrictMode double-invoke, or
// a tab regaining focus reuses the cached result instead of re-POSTing.
// This is the single-flight guard: not a manual lock, just telling React
// Query there's nothing to refetch until told otherwise.
export function useWorkspace() {
  const { query } = useCustom<Workspace, HttpError>({
    url: `${BACKEND_BASE_URL}demo/workspace`,
    method: "post",
    queryOptions: {
      staleTime: Infinity,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  });

  return query;
}
