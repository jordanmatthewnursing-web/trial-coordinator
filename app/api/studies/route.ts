import { registryRequest, registryError } from "@/lib/registry";
import { NextRequest, NextResponse } from "next/server";
import { normalizeSearchPayload } from "@/lib/study";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const condition = (request.nextUrl.searchParams.get("condition") || "")
    .trim()
    .slice(0, 100);
  const location = (request.nextUrl.searchParams.get("location") || "")
    .trim()
    .slice(0, 100);
  const pageToken = (request.nextUrl.searchParams.get("pageToken") || "")
    .trim()
    .slice(0, 400);
  if (!condition)
    return NextResponse.json({ error: "Enter a condition." }, { status: 400 });
  const params = new URLSearchParams({
    "query.cond": condition,
    "filter.overallStatus": "RECRUITING",
    pageSize: "12",
    countTotal: "true",
    format: "json",
  });
  if (location) params.set("query.locn", location);
  if (pageToken) params.set("pageToken", pageToken);
  try {
    const response = await registryRequest(
      `https://clinicaltrials.gov/api/v2/studies?${params}`,
      {
        signal: request.signal,
      },
    );
    if (response.status < 200 || response.status >= 300) throw Error(`Source status ${response.status}`);
    const payload = normalizeSearchPayload(response.data);
    if (!payload) throw Error("Invalid search response");
    return NextResponse.json(
      payload,
      { headers: { "Cache-Control": "public, max-age=0, s-maxage=300" } },
    );
  } catch (error) {
    const failure = registryError(error);
    return NextResponse.json(
      { error: failure.error },
      { status: 503, headers: failure.retryAfter ? { "Retry-After": failure.retryAfter } : {} },
    );
  }
}
