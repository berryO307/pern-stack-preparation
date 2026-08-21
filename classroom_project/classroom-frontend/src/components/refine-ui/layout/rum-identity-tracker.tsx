import { useEffect } from "react";
import { useGetIdentity } from "@refinedev/core";
import { setRumUserId } from "@/lib/rum.ts";

type Identity = { id: string };

// Mounted once inside the authenticated shell — pushes the signed-in user's id
// to Site24x7 RUM so sessions in the dashboard are attributable to a user.
export function RumIdentityTracker() {
  const { data: identity } = useGetIdentity<Identity>();

  useEffect(() => {
    if (identity?.id) setRumUserId(identity.id);
  }, [identity?.id]);

  return null;
}

RumIdentityTracker.displayName = "RumIdentityTracker";
