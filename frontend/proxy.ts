import { NextResponse, type NextRequest } from "next/server";

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

function copySessionCookie(response: NextResponse, authResponse: Response) {
  const cookie = authResponse.headers.get("set-cookie");
  if (cookie) response.headers.append("set-cookie", cookie);
  return response;
}

export async function proxy(request: NextRequest) {
  let authenticated = false;
  let authResponse: Response | undefined;
  try {
    authResponse = await fetch(`${API_URL}/api/v1/auth/me`, {
      headers: { Cookie: request.headers.get("cookie") ?? "" },
      cache: "no-store",
    });
    authenticated = authResponse.ok;
  } catch {
    authenticated = false;
  }

  if (!authenticated && request.nextUrl.pathname !== "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return authResponse ? copySessionCookie(NextResponse.redirect(url), authResponse) : NextResponse.redirect(url);
  }

  if (authenticated && request.nextUrl.pathname === "/login") {
    const githubError = request.nextUrl.searchParams.get("error");
    if (githubError?.startsWith("github_")) {
      const url = new URL("/repositories", request.url);
      url.searchParams.set("github_error", githubError);
      return copySessionCookie(NextResponse.redirect(url), authResponse!);
    }
    const next = request.nextUrl.searchParams.get("next");
    const destination = next?.startsWith("/") && !next.startsWith("//") ? next : "/";
    return copySessionCookie(NextResponse.redirect(new URL(destination, request.url)), authResponse!);
  }

  const response = NextResponse.next({ request });
  return authResponse ? copySessionCookie(response, authResponse) : response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
