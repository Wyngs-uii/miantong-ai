import { NextResponse } from "next/server";
import { getAllProviderStatus } from "../../../lib/ai-provider";

export async function GET(request: Request) {
  return NextResponse.json(getAllProviderStatus(request), {
    headers: { "Cache-Control": "no-store" },
  });
}
