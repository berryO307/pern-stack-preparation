"use client";

import { useEffect, useRef, useState } from "react";
import { useInvalidate } from "@refinedev/core";
import { Clock } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/hooks/use-workspace";
import { trackRumEvent } from "@/lib/rum";

const URGENT_THRESHOLD_MS = 5 * 60 * 1000;

const formatRemaining = (ms: number) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

export function WorkspaceBanner() {
  const { data, isLoading, refetch } = useWorkspace();
  const invalidate = useInvalidate();
  const [now, setNow] = useState(() => Date.now());
  const [resetting, setResetting] = useState(false);
  const trackedProvisionedId = useRef<string | null>(null);

  const workspace = data?.data;

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // wasJustProvisioned stays true on every cached re-render of the same
  // response, not just the first one - track which workspace id it's
  // already been reported for so this fires once per real provision, not
  // once per render.
  useEffect(() => {
    if (
      workspace?.wasJustProvisioned &&
      trackedProvisionedId.current !== workspace.id
    ) {
      trackedProvisionedId.current = workspace.id;
      trackRumEvent("workspace_provisioned");
    }
  }, [workspace]);

  const remainingMs = workspace ? new Date(workspace.expiresAt).getTime() - now : null;

  // The backend only re-provisions/reseeds lazily, on the next request after
  // expiry - once the countdown hits zero, that "next request" is this
  // refetch, and invalidating every resource pulls the fresh (reseeded) data
  // into view without a full page reload.
  useEffect(() => {
    if (remainingMs !== null && remainingMs <= 0 && !resetting) {
      setResetting(true);
      trackRumEvent("workspace_reset");
      Promise.all([refetch(), invalidate({ invalidates: ["all"] })]).finally(() => {
        setResetting(false);
      });
    }
  }, [remainingMs, resetting, refetch, invalidate]);

  if (isLoading || !workspace || workspace.isPermanent) return null;

  const urgent = (remainingMs ?? 0) < URGENT_THRESHOLD_MS;

  return (
    <Alert
      variant={urgent ? "destructive" : "default"}
      className={cn(
        "flex items-center gap-2 rounded-none border-x-0 border-t-0 py-2"
      )}
    >
      <Clock />
      <AlertDescription className="flex-row items-center gap-1 text-xs sm:text-sm">
        {resetting ? (
          <span>Resetting your demo workspace...</span>
        ) : (
          <span>
            This is a temporary demo workspace - it resets in{" "}
            <span className="font-medium tabular-nums">
              {formatRemaining(remainingMs ?? 0)}
            </span>
            , clearing anything you&apos;ve created.
          </span>
        )}
      </AlertDescription>
    </Alert>
  );
}

WorkspaceBanner.displayName = "WorkspaceBanner";
