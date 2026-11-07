import { beforeEach, describe, expect, it } from "vitest";
import { openDb, type Db } from "../lib/db";
import { cancelBooking, createBooking, getAvailability } from "../lib/booking";

let db: Db;
let standard: number; 
let deluxe: number; 
let broken: number; 

const guest = { guestName: "Asha Verma", phone: "9876543210" };
const book = (roomId: number, checkIn: string, checkOut: string, extra: object = {}) =>
  createBooking(db, { roomId, checkIn, checkOut, ...guest, ...extra });
const freeIds = (ci: string, co: string, cat?: string) => {
  const r = getAvailability(db, ci, co, cat);
  if (!r.ok) throw new Error(r.error);
  return r.data.rooms.map((x) => x.id);
};

beforeEach(() => {
  db = openDb(":memory:");
  const ins = db.prepare("INSERT INTO rooms (number, category, price_per_night, status) VALUES (?,?,?,?)");
  standard = Number(ins.run("101", "Standard", 1000, "available").lastInsertRowid);
  deluxe = Number(ins.run("201", "Deluxe", 2000, "available").lastInsertRowid);
  broken = Number(ins.run("102", "Standard", 1000, "maintenance").lastInsertRowid);
});

describe("clash rules", () => {
  it("guest leaving on 20 Nov does not block a guest arriving on 20 Nov", () => {
    expect(book(standard, "2026-11-18", "2026-11-20").ok).toBe(true);
    expect(freeIds("2026-11-20", "2026-11-22")).toContain(standard);
    expect(book(standard, "2026-11-20", "2026-11-22").status).toBe(201);
  });

  it("a guest arriving on the day an existing guest checks in, leaving that day, is fine (back-to-back before)", () => {
    expect(book(standard, "2026-11-20", "2026-11-22").ok).toBe(true);
    expect(book(standard, "2026-11-18", "2026-11-20").status).toBe(201);
  });

  it.each([
    ["identical", "2026-11-10", "2026-11-14"],
    ["overlaps start", "2026-11-08", "2026-11-11"],
    ["overlaps end", "2026-11-13", "2026-11-16"],
    ["contained inside", "2026-11-11", "2026-11-12"],
    ["contains existing", "2026-11-08", "2026-11-20"],
    ["one-night at the first night", "2026-11-10", "2026-11-11"],
    ["one-night at the last night", "2026-11-13", "2026-11-14"],
  ])("rejects %s with 409", (_name, ci, co) => {
    expect(book(standard, "2026-11-10", "2026-11-14").ok).toBe(true);
    expect(book(standard, ci, co).status).toBe(409);
    expect(freeIds(ci, co)).not.toContain(standard);
  });

  it("cancelled bookings block nothing", () => {
    const b = book(standard, "2026-11-10", "2026-11-14");
    if (!b.ok) throw new Error("setup failed");
    expect(freeIds("2026-11-10", "2026-11-14")).not.toContain(standard);

    expect(cancelBooking(db, b.data.id).ok).toBe(true);
    expect(freeIds("2026-11-10", "2026-11-14")).toContain(standard);
    expect(book(standard, "2026-11-11", "2026-11-13").status).toBe(201);
  });

  it("maintenance rooms are never free and cannot be booked", () => {
    expect(freeIds("2026-12-01", "2026-12-03")).not.toContain(broken);
    expect(freeIds("2026-12-01", "2026-12-03", "Standard")).toEqual([standard]);
    expect(book(broken, "2026-12-01", "2026-12-03").status).toBe(409);
  });

  it("the same room cannot be booked twice for the same night", () => {
    expect(book(standard, "2026-11-10", "2026-11-12").status).toBe(201);
    expect(book(standard, "2026-11-10", "2026-11-12").status).toBe(409);
  });

  it("a clash on one room does not affect other rooms", () => {
    book(standard, "2026-11-10", "2026-11-12");
    expect(book(deluxe, "2026-11-10", "2026-11-12").status).toBe(201);
  });
});

describe("availability", () => {
  it("returns total price = nights x nightly rate", () => {
    const r = getAvailability(db, "2026-11-10", "2026-11-13");
    if (!r.ok) throw new Error(r.error);
    expect(r.data.nights).toBe(3);
    const byId = Object.fromEntries(r.data.rooms.map((x) => [x.id, x.totalPrice]));
    expect(byId[standard]).toBe(3000);
    expect(byId[deluxe]).toBe(6000);
  });

  it("filters by category (case-insensitive) and treats empty category as all", () => {
    expect(freeIds("2026-11-10", "2026-11-12", "deluxe")).toEqual([deluxe]);
    expect(freeIds("2026-11-10", "2026-11-12", "")).toEqual([standard, deluxe]);
    expect(freeIds("2026-11-10", "2026-11-12", "Penthouse")).toEqual([]);
  });

  it("handles stays that cross month and year boundaries", () => {
    const r = getAvailability(db, "2026-12-30", "2027-01-02");
    if (!r.ok) throw new Error(r.error);
    expect(r.data.nights).toBe(3);
  });
});

describe("validation", () => {
  it.each([
    ["checkOut equals checkIn", "2026-11-10", "2026-11-10"],
    ["checkOut before checkIn", "2026-11-12", "2026-11-10"],
    ["malformed date", "10/11/2026", "2026-11-12"],
    ["impossible date", "2026-02-30", "2026-03-02"],
  ])("rejects %s with 400 (booking and availability)", (_n, ci, co) => {
    expect(book(standard, ci, co).status).toBe(400);
    expect(getAvailability(db, ci, co).status).toBe(400);
  });

  it("rejects missing dates on availability", () => {
    expect(getAvailability(db, null, null).status).toBe(400);
  });

  it("rejects a past checkIn date", () => {
    expect(book(standard, "2020-01-01", "2020-01-03").status).toBe(400);
    expect(getAvailability(db, "2020-01-01", "2020-01-03").status).toBe(400);
  });

  it.each(["123456789", "12345678901", "98765abcde", "", "9876 5432 10 1"])(
    "rejects phone %j with 400",
    (phone) => {
      expect(book(standard, "2026-11-10", "2026-11-12", { phone }).status).toBe(400);
    }
  );

  it.each(["+919876543210", "98765 43210", "9876-543210"])(
    "accepts phone %j after normalisation",
    (phone) => {
      expect(book(standard, "2026-11-10", "2026-11-12", { phone }).status).toBe(201);
    }
  );

  it("rejects a missing guest name and non-object bodies with 400", () => {
    expect(book(standard, "2026-11-10", "2026-11-12", { guestName: "   " }).status).toBe(400);
    expect(createBooking(db, null).status).toBe(400);
    expect(createBooking(db, "nope").status).toBe(400);
  });

  it("validation failures save nothing", () => {
    book(standard, "2026-11-10", "2026-11-10");
    book(standard, "2026-11-10", "2026-11-12", { phone: "1" });
    expect(book(standard, "2026-11-10", "2026-11-12").status).toBe(201);
  });

  it("returns 404 for an unknown room", () => {
    expect(book(9999, "2026-11-10", "2026-11-12").status).toBe(404);
  });
});

describe("cancel", () => {
  it("404 for unknown booking, and cancelling twice is harmless", () => {
    expect(cancelBooking(db, 12345).status).toBe(404);
    const b = book(standard, "2026-11-10", "2026-11-12");
    if (!b.ok) throw new Error("setup failed");
    expect(cancelBooking(db, b.data.id).ok).toBe(true);
    expect(cancelBooking(db, b.data.id).ok).toBe(true);
  });
});
