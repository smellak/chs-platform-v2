import { parseCHSHeaders } from "../parse-headers";
import type { CHSUser } from "../types";

export type { CHSUser };
export { parseCHSHeaders };

interface NextRequestLike {
  headers: {
    forEach: (callback: (value: string, key: string) => void) => void;
  };
}

export function getCHSUser(request: NextRequestLike): CHSUser | null {
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });
  return parseCHSHeaders(headers);
}
