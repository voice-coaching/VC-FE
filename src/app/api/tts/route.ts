import { GET as backendGet } from "../backend/[...proxyPath]/route";

export const dynamic = "force-dynamic";

// Legacy URL accepts DB example IDs only. Authentication and binary response
// handling are identical to the backend proxy; static IDs are not translated.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const exampleId = url.searchParams.get("exampleId");
  if (!exampleId || !/^[a-zA-Z0-9_-]{1,100}$/.test(exampleId)) {
    return Response.json(
      {
        result: false,
        data: null,
        code: "VALIDATION_ERROR",
        message: "올바른 예문 ID가 필요합니다.",
      },
      { status: 400 },
    );
  }
  url.searchParams.delete("exampleId");
  return backendGet(new Request(url, request), {
    params: Promise.resolve({
      proxyPath: ["api", "practice-examples", exampleId, "audio"],
    }),
  });
}
