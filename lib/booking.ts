import type { Db } from "./db";

export type Result<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: string };

const fail = (status: number, error: string): Result<never> => ({ ok: false, status, error });
const success = <T>(data: T, status = 200): Result<T> => ({ ok: true, status, data });

export interface Room {
  id: number;
  number: string;
  category: string;
  pricePerNight: number;
  status: "available" | "maintenance";
}

export interface Booking {
  id: number;
  roomId: number;
  roomNumber: string;
  category: string;
  guestName: string;
  phone: string;
  checkIn: string;
  checkOut: string;
  status: "confirmed" | "cancelled";
}

export interface AvailableRoom {
  id: number;
  number: string;
  category: string;
  pricePerNight: number;
  totalPrice: number;
}

function parseDate(s: unknown): number | null {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const t = Date.parse(`${s}T00:00:00Z`);
  if (Number.isNaN(t) || new Date(t).toISOString().slice(0, 10) !== s) return null;
  return t;
}

export function nightsBetween(checkIn: string, checkOut: string): number {
  return Math.round((Date.parse(`${checkOut}T00:00:00Z`) - Date.parse(`${checkIn}T00:00:00Z`)) / 86_400_000);
}

export function validateStay(checkIn: unknown, checkOut: unknown): string | null {
  const a = parseDate(checkIn);
  const b = parseDate(checkOut);
  if (a === null) return "checkIn must be a valid date in YYYY-MM-DD format";
  if (b === null) return "checkOut must be a valid date in YYYY-MM-DD format";
  const today = Date.parse(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
  if (a < today) return "checkIn cannot be in the past";
  if (b <= a) return "checkOut must be after checkIn";
  return null;
}

export function normalisePhone(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const stripped = raw.replace(/^\+91/, "").replace(/[\s\-]/g, "");
  return /^\d{10}$/.test(stripped) ? stripped : null;
}

export const isValidPhone = (p: unknown): p is string => normalisePhone(p) !== null;


const CLASH_CLAUSE = `
  EXISTS (
    SELECT 1 FROM bookings b
    WHERE b.room_id = r.id
      AND b.status <> 'cancelled'
      AND b.check_in < @checkOut
      AND b.check_out > @checkIn
  )`;


export function getAvailability(
  db: Db,
  checkIn: unknown,
  checkOut: unknown,
  category?: string | null
): Result<{ checkIn: string; checkOut: string; nights: number; rooms: AvailableRoom[] }> {
  const err = validateStay(checkIn, checkOut);
  if (err) return fail(400, err);
  const ci = checkIn as string;
  const co = checkOut as string;
  const nights = nightsBetween(ci, co);

  const rows = db
    .prepare(
      `SELECT r.id, r.number, r.category, r.price_per_night AS pricePerNight
       FROM rooms r
       WHERE r.status = 'available'
         AND (@category IS NULL OR r.category = @category COLLATE NOCASE)
         AND NOT ${CLASH_CLAUSE}
       ORDER BY r.number`
    )
    .all({ checkIn: ci, checkOut: co, category: category?.trim() || null }) as Omit<AvailableRoom, "totalPrice">[];

  return success({
    checkIn: ci,
    checkOut: co,
    nights,
    rooms: rows.map((r) => ({ ...r, totalPrice: r.pricePerNight * nights })),
  });
}


export function createBooking(db: Db, input: unknown): Result<Booking & { totalPrice: number }> {
  if (typeof input !== "object" || input === null) return fail(400, "Request body must be a JSON object");
  const { roomId, guestName, phone, checkIn, checkOut } = input as Record<string, unknown>;

  const stayErr = validateStay(checkIn, checkOut);
  if (stayErr) return fail(400, stayErr);
  const cleanPhone = normalisePhone(phone);
  if (!cleanPhone) return fail(400, "phone must be 10 digits (optionally prefixed with +91 or spaces)");
  const name = typeof guestName === "string" ? guestName.trim() : "";
  if (!name) return fail(400, "guestName is required");
  if (name.length > 100) return fail(400, "guestName is too long");
  if (typeof roomId !== "number" || !Number.isInteger(roomId)) return fail(400, "roomId must be an integer");

  const ci = checkIn as string;
  const co = checkOut as string;

  const tx = db.transaction((): Result<Booking & { totalPrice: number }> => {
    const room = db
      .prepare("SELECT id, number, category, price_per_night AS pricePerNight, status FROM rooms WHERE id = ?")
      .get(roomId) as Room | undefined;
    if (!room) return fail(404, "Room not found");
    if (room.status === "maintenance") return fail(409, `Room ${room.number} is under maintenance`);

    const clash = db
      .prepare(`SELECT r.id FROM rooms r WHERE r.id = @roomId AND ${CLASH_CLAUSE}`)
      .get({ roomId, checkIn: ci, checkOut: co });
    if (clash) return fail(409, `Room ${room.number} is already booked for part of these dates`);

    const info = db
      .prepare("INSERT INTO bookings (room_id, guest_name, phone, check_in, check_out) VALUES (?, ?, ?, ?, ?)")
      .run(roomId, name, cleanPhone, ci, co);

    return success(
      {
        id: Number(info.lastInsertRowid),
        roomId,
        roomNumber: room.number,
        category: room.category,
        guestName: name,
        phone: cleanPhone,
        checkIn: ci,
        checkOut: co,
        status: "confirmed",
        totalPrice: room.pricePerNight * nightsBetween(ci, co),
      },
      201
    );
  });
  return tx.immediate();
}


const BOOKING_SELECT = `
  SELECT b.id, b.room_id AS roomId, r.number AS roomNumber, r.category,
         b.guest_name AS guestName, b.phone, b.check_in AS checkIn,
         b.check_out AS checkOut, b.status
  FROM bookings b JOIN rooms r ON r.id = b.room_id`;

export function listBookings(db: Db): Booking[] {
  return db.prepare(`${BOOKING_SELECT} ORDER BY b.check_in DESC, b.id DESC`).all() as Booking[];
}

export function cancelBooking(db: Db, id: number): Result<Booking> {
  if (!Number.isInteger(id)) return fail(400, "Invalid booking id");
  const info = db.prepare("UPDATE bookings SET status = 'cancelled' WHERE id = ?").run(id);
  if (info.changes === 0) return fail(404, "Booking not found");
  return success(db.prepare(`${BOOKING_SELECT} WHERE b.id = ?`).get(id) as Booking);
}
