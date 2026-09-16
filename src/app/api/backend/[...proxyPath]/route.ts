const UPSTREAM_BASE_URL =
  process.env.API_BASE_URL?.trim() ||
  process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
  "";

const REQUEST_HEADER_BLOCKLIST = new Set([
  "connection",
  "content-length",
  "host",
  "origin",
  "referer",
  "sec-fetch-dest",
  "sec-fetch-mode",
  "sec-fetch-site",
]);

const RESPONSE_HEADER_BLOCKLIST = new Set([
  "connection",
  "content-encoding",
  "content-length",
  "set-cookie",
  "transfer-encoding",
]);

type ProxyContext = {
  params: Promise<{ proxyPath: string[] }>;
};

function unavailableResponse(message: string) {
  return Response.json(
    {
      result: false,
      message,
      data: null,
      code: "UPSTREAM_UNAVAILABLE",
    },
    { status: 503 },
  );
}

function proxyCookie(cookie: string) {
  const withoutDomain = cookie.replace(/;\s*Domain=[^;]*/gi, "");
  const withRootPath = /;\s*Path=/i.test(withoutDomain)
    ? withoutDomain.replace(/;\s*Path=[^;]*/i, "; Path=/")
    : `${withoutDomain}; Path=/`;
  return withRootPath;
}

async function proxyRequest(request: Request, context: ProxyContext) {
  if (!UPSTREAM_BASE_URL) {
    return unavailableResponse("백엔드 서버 주소가 설정되지 않았습니다.");
  }

  let upstreamBase: URL;
  try {
    upstreamBase = new URL(UPSTREAM_BASE_URL);
  } catch {
    return unavailableResponse("백엔드 서버 주소 형식이 올바르지 않습니다.");
  }

  if (!/^https?:$/.test(upstreamBase.protocol)) {
    return unavailableResponse("백엔드 서버는 HTTP 또는 HTTPS여야 합니다.");
  }

  const { proxyPath } = await context.params;
  const targetPath = proxyPath.map(encodeURIComponent).join("/");
  const requestUrl = new URL(request.url);
  const upstreamUrl = new URL(
    targetPath,
    `${upstreamBase.toString().replace(/\/$/, "")}/`,
  );
  upstreamUrl.search = requestUrl.search;

  if (upstreamUrl.origin === requestUrl.origin) {
    return unavailableResponse(
      "백엔드 프록시가 자기 자신을 가리키고 있습니다.",
    );
  }

  const requestHeaders = new Headers();
  request.headers.forEach((value, key) => {
    if (!REQUEST_HEADER_BLOCKLIST.has(key.toLowerCase())) {
      requestHeaders.set(key, value);
    }
  });
  requestHeaders.set("x-forwarded-origin", requestUrl.origin);

  const hasBody = !["GET", "HEAD"].includes(request.method);
  try {
    const upstreamResponse = await fetch(upstreamUrl, {
      method: request.method,
      headers: requestHeaders,
      body: hasBody ? await request.arrayBuffer() : undefined,
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(60_000),
    });

    const responseHeaders = new Headers();
    upstreamResponse.headers.forEach((value, key) => {
      if (!RESPONSE_HEADER_BLOCKLIST.has(key.toLowerCase())) {
        responseHeaders.set(key, value);
      }
    });
    responseHeaders.set("cache-control", "no-store");

    const upstreamHeaders = upstreamResponse.headers as Headers & {
      getSetCookie?: () => string[];
    };
    const setCookies =
      upstreamHeaders.getSetCookie?.() ??
      (upstreamResponse.headers.get("set-cookie")
        ? [upstreamResponse.headers.get("set-cookie") as string]
        : []);
    setCookies.forEach((cookie) =>
      responseHeaders.append("set-cookie", proxyCookie(cookie)),
    );

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders,
    });
  } catch (reason) {
    const timedOut =
      reason instanceof DOMException && reason.name === "TimeoutError";
    return unavailableResponse(
      timedOut
        ? "백엔드 서버 응답 시간이 초과되었습니다."
        : "백엔드 서버에 연결할 수 없습니다.",
    );
  }
}

export const dynamic = "force-dynamic";

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const PATCH = proxyRequest;
export const DELETE = proxyRequest;
export const HEAD = proxyRequest;
export const OPTIONS = proxyRequest;
