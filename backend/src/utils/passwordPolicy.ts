export function validNewPassword(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 8 && Buffer.byteLength(value, 'utf8') <= 72;
}
export const passwordPolicyMessage = 'Use at least 8 characters and no more than 72 bytes for your password.';
