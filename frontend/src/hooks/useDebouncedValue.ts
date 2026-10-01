import { useEffect, useState } from 'react';

/**
 * Keeps fast-changing filter input responsive without issuing a request for
 * every keystroke on server-backed pages.
 */
export function useDebouncedValue<T>(value: T, delayMs = 350): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => window.clearTimeout(timeoutId);
  }, [delayMs, value]);

  return debouncedValue;
}

export default useDebouncedValue;