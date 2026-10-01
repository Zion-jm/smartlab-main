type ShutdownDependencies = {
  closeHttp: () => Promise<void>;
  drain: () => Promise<void>;
  disconnect: () => Promise<void>;
  exit: (code: number) => void;
  graceMs?: number;
};

/** Idempotent: finish requests, then post-commit work, then close the shared pool. */
export function createShutdown({ closeHttp, drain, disconnect, exit, graceMs = 65000 }: ShutdownDependencies) {
  let closing: Promise<void> | undefined;
  return (): Promise<void> => {
    if (closing) return closing;
    closing = (async () => {
      const timer = setTimeout(() => exit(1), graceMs);
      timer.unref();
      try {
        await closeHttp();
        await drain();
        await disconnect();
        clearTimeout(timer);
        exit(0);
      } catch {
        console.error('SmartLab shutdown failed.');
        clearTimeout(timer);
        exit(1);
      }
    })();
    return closing;
  };
}
