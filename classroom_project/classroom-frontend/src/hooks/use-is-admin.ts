import { useGetIdentity } from "@refinedev/core";

type Identity = {
  role?: string;
};

export function useIsAdmin() {
  const { data: identity, isLoading } = useGetIdentity<Identity>();
  return { isAdmin: identity?.role === "admin", isLoading };
}
