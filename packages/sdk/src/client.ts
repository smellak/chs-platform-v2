export function getCHSLoginUrl(platformUrl: string, redirectUrl?: string): string {
  const redirect = redirectUrl ?? (typeof window !== "undefined" ? window.location.href : "");
  return `${platformUrl}/login?redirect=${encodeURIComponent(redirect)}`;
}
