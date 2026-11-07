import type { NextRequest } from "next/server";
import { getDb } from "../../../lib/db";
import { getAvailability } from "../../../lib/booking";
import { toResponse } from "../../../lib/http";

export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  return toResponse(getAvailability(getDb(), sp.get("checkIn"), sp.get("checkOut"), sp.get("category")));
}
