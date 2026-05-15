import { QueryClient, QueryCache, MutationCache } from "@tanstack/react-query";
import { removeToken } from "@/lib/auth";

function handleError(error: unknown) {
  const status = (error as any)?.status ?? (error as any)?.response?.status;
  if (status === 401) {
    removeToken();
    window.location.replace("/login");
  }
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: handleError }),
  mutationCache: new MutationCache({ onError: handleError }),
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (((error as any)?.status ?? (error as any)?.response?.status) === 401) return false;
        return failureCount < 1;
      },
      staleTime: 30_000,
    },
  },
});
