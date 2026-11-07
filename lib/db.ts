import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

export type Db = Database.Database;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS rooms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  number TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  price_per_night INTEGER NOT NULL CHECK (price_per_night >= 0),
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available','maintenance'))
);
CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id INTEGER NOT NULL REFERENCES rooms(id),
  guest_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  check_in TEXT NOT NULL,
  check_out TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed','cancelled')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (check_out > check_in)
);
CREATE INDEX IF NOT EXISTS idx_bookings_room_dates ON bookings(room_id, check_in, check_out);
`;

const SEED_ROOMS: [string, string, number, string][] = [
  ["101", "Standard", 2500, "available"],
  ["102", "Standard", 2500, "available"],
  ["103", "Standard", 2500, "available"],
  ["104", "Standard", 2500, "maintenance"],
  ["201", "Deluxe", 4000, "available"],
  ["202", "Deluxe", 4000, "available"],
  ["203", "Deluxe", 4000, "available"],
  ["301", "Suite", 7000, "available"],
  ["302", "Suite", 7000, "available"],
];

export function openDb(file: string, opts: { seed?: boolean } = {}): Db {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  if (opts.seed) {
    const { n } = db.prepare("SELECT COUNT(*) AS n FROM rooms").get() as { n: number };
    if (n === 0) {
      const ins = db.prepare(
        "INSERT INTO rooms (number, category, price_per_night, status) VALUES (?, ?, ?, ?)"
      );
      db.transaction(() => SEED_ROOMS.forEach((r) => ins.run(...r)))();
    }
  }
  return db;
}

const g = globalThis as unknown as { __nimbaDb?: Db };

export function getDb(): Db {
  if (!g.__nimbaDb) {
    g.__nimbaDb = openDb(process.env.NIMBA_DB ?? path.join(process.cwd(), "data", "nimba.db"), {
      seed: true,
    });
  }
  return g.__nimbaDb;
}
