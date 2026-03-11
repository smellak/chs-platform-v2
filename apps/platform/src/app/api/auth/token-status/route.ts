import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify, decodeJwt } from "jose";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = request.cookies.get("chs_access_token")?.value;

  if (!token) {
    return NextResponse.json({ authenticated: false, expiresIn: 0 });
  }

  try {
    // Try to decode the JWT to get the exp claim
    const claims = decodeJwt(token);
    const exp = claims.exp;

    if (!exp) {
      return NextResponse.json({ authenticated: false, expiresIn: 0 });
    }

    const now = Math.floor(Date.now() / 1000);
    const expiresIn = exp - now;

    // Also verify the signature to confirm it's valid (not just expired)
    const secret = process.env["JWT_SECRET"];
    if (!secret) {
      return NextResponse.json({ authenticated: false, expiresIn: 0 });
    }

    try {
      await jwtVerify(token, new TextEncoder().encode(secret), {
        algorithms: ["HS256"],
      });
      // Token is valid and not expired
      return NextResponse.json({
        authenticated: true,
        expiresIn: Math.max(0, expiresIn),
        expiresAt: new Date(exp * 1000).toISOString(),
      });
    } catch {
      // Token is expired but was once valid
      return NextResponse.json({
        authenticated: false,
        expiresIn: 0,
        expired: true,
      });
    }
  } catch {
    return NextResponse.json({ authenticated: false, expiresIn: 0 });
  }
}
