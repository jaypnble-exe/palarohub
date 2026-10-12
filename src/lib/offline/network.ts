/**
 * True when a Supabase call failed because the server could not be reached,
 * as opposed to the server refusing it. Those calls are safe to retry later.
 */
export function isNetworkError(error: {
  message?: string;
  code?: string;
  name?: string;
}) {
  if (error.name === "AuthRetryableFetchError") return true;
  if (error.code) return false;
  return /failed to fetch|networkerror|load failed|network request failed|fetch failed/i.test(
    error.message ?? "",
  );
}
