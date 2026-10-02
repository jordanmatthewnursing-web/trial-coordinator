import { registryRequest, registryError } from "@/lib/registry";
import { NextRequest, NextResponse } from "next/server";
import { normalizeStudy } from "@/lib/study";

export const dynamic = "force-dynamic";
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!/^NCT\d{8}$/.test(id))
    return NextResponse.json({ error: "Invalid study ID." }, { status: 400 });
  try {
    const response = await registryRequest(
      `https://clinicaltrials.gov/api/v2/studies/${id}`,
      {
        signal: _request.signal,
      },
    );
    if (response.status === 404)
      return NextResponse.json({ error: "Study not found." }, { status: 404 });
    if (response.status < 200 || response.status >= 300) throw Error(`Source status ${response.status}`);
    const study = normalizeStudy(response.data);
    if (!study || study.id !== id)
      return NextResponse.json(
        { error: "Invalid source record." },
        { status: 502 },
      );
    return NextResponse.json(study, {
      headers: { "Cache-Control": _request.nextUrl.searchParams.get("refresh") === "1" ? "no-store" : "public, max-age=0, s-maxage=300" },
    });
  } catch (error) {
    const failure = registryError(error);
    return NextResponse.json(
      { error: failure.error },
      { status: 503, headers: failure.retryAfter ? { "Retry-After": failure.retryAfter } : {} },
    );
  }
}
