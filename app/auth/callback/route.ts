import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl, authIsConfigured } from "@/lib/supabase/config";
import { safeNext } from "@/lib/auth/validation";

export async function GET(request: NextRequest) {
  const origin = getSiteUrl();
  if (!origin || !authIsConfigured()) {
    return new NextResponse("Account access is not available yet.", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
  const code = request.nextUrl.searchParams.get("code");
  const next = safeNext(request.nextUrl.searchParams.get("next"));
  if (code && code.length <= 4096) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        return NextResponse.redirect(new URL(next, origin), {
          headers: { "Cache-Control": "private, no-store" },
        });
      }
    } catch {
      /* Invalid/expired links take the same safe recovery path. */
    }
  }
  return NextResponse.redirect(new URL("/auth/error", origin), {
    headers: { "Cache-Control": "private, no-store" },
  });
}
