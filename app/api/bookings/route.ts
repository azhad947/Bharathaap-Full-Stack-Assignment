import { NextResponse } from "next/server";
import { getDb } from "../../../lib/db";
import { createBooking, listBookings } from "../../../lib/booking";
import { toResponse } from "../../../lib/http";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(listBookings(getDb()));
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }
  return toResponse(createBooking(getDb(), body));
}
