import { useGetIdentity } from "@refinedev/core";

type Identity = {
  role?: string;
  isAnonymous?: boolean;
};

export function useIsAdmin() {
  const { data: identity, isLoading } = useGetIdentity<Identity>();
  return { isAdmin: identity?.role === "admin", isLoading };
}
