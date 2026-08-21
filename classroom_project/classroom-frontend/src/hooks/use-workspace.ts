import { useCustom, type HttpError } from "@refinedev/core";
import { BACKEND_BASE_URL } from "@/constants";

export type Workspace = {
  id: string;
  expiresAt: string;
  isPermanent: boolean;
  wasJustProvisioned: boolean;
};

// POST /api/demo/workspace is idempotent - returns the caller's existing
// workspace if it's still valid, or provisions a fresh one. Calling it here
// (fired once per authenticated page load) gets expiresAt up front for the
// countdown banner, rather than waiting on the first domain data fetch to
// trigger provisioning lazily with no expiresAt to show.
export function useWorkspace() {
  const { query } = useCustom<Workspace, HttpError>({
    url: `${BACKEND_BASE_URL}demo/workspace`,
    method: "post",
  });

  return query;
}
