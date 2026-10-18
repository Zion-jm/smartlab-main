// Setup credentials are memory-only and separate from normal user sessions.
export async function setupRequest<T>(path: string, body: object = {}, token = '', session = ''): Promise<T> {
  const response = await fetch(`${import.meta.env.VITE_API_BASE_URL ?? '/api'}/setup/${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Setup-Token': token, 'X-Setup-Session': session },
    body: JSON.stringify(body), cache: 'no-store', signal: AbortSignal.timeout(20000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Setup could not be completed. Please try again.');
  return data as T;
}
export function setupError(error: unknown) {
  return error instanceof Error && error.name !== 'TimeoutError' && error.name !== 'TypeError'
    ? error.message : 'Unable to reach the server. Check your connection and try again.';
}
