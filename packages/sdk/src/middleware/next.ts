import { parseAlephHeaders } from "../parse-headers";
import type { AlephUser } from "../types";

export type { AlephUser };
export { parseAlephHeaders };

interface NextRequestLike {
  headers: {
    forEach: (callback: (value: string, key: string) => void) => void;
  };
}

export function getAlephUser(request: NextRequestLike): AlephUser | null {
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });
  return parseAlephHeaders(headers);
}
