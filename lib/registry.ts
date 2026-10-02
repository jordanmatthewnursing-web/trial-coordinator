/** One request budget covers attempts, response bodies, and backoff. */
const retryable = new Set([429, 502, 503, 504]);
export class RegistryUnavailable extends Error {
  readonly retryAfter: string | null;
  constructor(retryAfter: string | null = null) {
    super("The public registry is temporarily unavailable. Try again shortly.");
    this.retryAfter = retryAfter;
  }
}
export function retryDelay(value: string | null, now = Date.now()): number | null {
  if (!value) return null;
  if (/^\d+$/.test(value.trim())) return Number(value) * 1000;
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - now) : null;
}
const sleep = (ms: number, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  signal.throwIfAborted();
  const abort = () => { clearTimeout(timer); reject(signal.reason); };
  const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, ms);
  signal.addEventListener("abort", abort, { once: true });
});
export async function registryRequest(
  url: string,
  options: { signal?: AbortSignal; fetcher?: typeof fetch; wait?: typeof sleep; timeoutMs?: number } = {},
): Promise<{ status: number; data: unknown }> {
  const deadline = AbortSignal.timeout(options.timeoutMs ?? 12000);
  const signal = options.signal ? AbortSignal.any([options.signal, deadline]) : deadline;
  const fetcher = options.fetcher ?? fetch;
  const wait = options.wait ?? sleep;
  for (let attempt = 0; attempt < 3; attempt++) {
    signal.throwIfAborted();
    let response: Response;
    try {
      response = await fetcher(url, { signal, cache: "no-store", headers: { Accept: "application/json" } });
    } catch (error) {
      if (signal.aborted || attempt === 2) throw error;
      await wait(300 * 2 ** attempt, signal);
      continue;
    }
    if (!retryable.has(response.status)) {
      if (!response.ok) { await response.body?.cancel(); return { status: response.status, data: null }; }
      return { status: response.status, data: await response.json() };
    }
    const header = response.headers.get("Retry-After");
    const delay = retryDelay(header);
    await response.body?.cancel();
    // Do not retry earlier than the registry requests or keep a user waiting through a long cooldown.
    if (attempt === 2 || (delay !== null && delay > 2000)) {
      throw new RegistryUnavailable(delay !== null ? String(Math.max(1, Math.ceil(delay / 1000))) : null);
    }
    await wait(delay ?? 300 * 2 ** attempt, signal);
  }
  throw new RegistryUnavailable();
}
export function registryError(error: unknown) {
  return {
    error: error instanceof RegistryUnavailable ? error.message : "The public registry could not be reached. Try again shortly.",
    retryAfter: error instanceof RegistryUnavailable ? error.retryAfter : null,
  };
}
