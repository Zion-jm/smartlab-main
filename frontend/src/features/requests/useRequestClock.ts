import { useEffect, useState } from 'react';

/** Keeps same-day request choices current while a form remains open. */
export function useRequestClock(refreshMs = 30_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), refreshMs);
    return () => window.clearInterval(timer);
  }, [refreshMs]);
  return now;
}
