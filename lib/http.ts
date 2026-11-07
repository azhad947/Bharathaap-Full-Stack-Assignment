import { NextResponse } from "next/server";
import type { Result } from "./booking";

export function toResponse<T>(r: Result<T>) {
  return r.ok
    ? NextResponse.json(r.data, { status: r.status })
    : NextResponse.json({ error: r.error }, { status: r.status });
}
