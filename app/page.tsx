"use client";

import { useCallback, useEffect, useState } from "react";
import { CATEGORIES } from "../lib/constants";

interface AvailableRoom {
  id: number;
  number: string;
  category: string;
  pricePerNight: number;
  totalPrice: number;
}
interface Search {
  checkIn: string;
  checkOut: string;
  nights: number;
  rooms: AvailableRoom[];
}
interface Booking {
  id: number;
  roomNumber: string;
  category: string;
  guestName: string;
  phone: string;
  checkIn: string;
  checkOut: string;
  status: "confirmed" | "cancelled";
}

export default function Page() {
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [category, setCategory] = useState("");

  const [search, setSearch] = useState<Search | null>(null);
  const [roomId, setRoomId] = useState<number | null>(null);
  const [guestName, setGuestName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [bookings, setBookings] = useState<Booking[]>([]);

  const loadBookings = useCallback(async () => {
    const res = await fetch("/api/bookings");
    if (res.ok) setBookings(await res.json());
  }, []);
  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  async function runSearch(ci = checkIn, co = checkOut, cat = category) {
    setError("");
    const q = new URLSearchParams({ checkIn: ci, checkOut: co, category: cat });
    const res = await fetch(`/api/availability?${q}`);
    const data = await res.json();
    if (!res.ok) {
      setSearch(null);
      setRoomId(null);
      return setError(data.error ?? "Search failed");
    }
    setSearch(data);
    setRoomId((prev) => (data.rooms.some((r: AvailableRoom) => r.id === prev) ? prev : null));
  }

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    setInfo("");
    await runSearch();
  }

  async function onBook(e: React.FormEvent) {
    e.preventDefault();
    if (!search || roomId === null) return setError("Search and select a room first");
    setError("");
    setInfo("");
    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId, guestName, phone, checkIn: search.checkIn, checkOut: search.checkOut }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Booking failed");
      if (res.status === 409) await runSearch(search.checkIn, search.checkOut, category);
      return;
    }
    setInfo(`Booked room ${data.roomNumber}, ${data.checkIn} to ${data.checkOut}, total ₹${data.totalPrice}`);
    setGuestName("");
    setPhone("");
    setRoomId(null);
    await Promise.all([runSearch(search.checkIn, search.checkOut, category), loadBookings()]);
  }

  async function onCancel(id: number) {
    setError("");
    const res = await fetch(`/api/bookings/${id}/cancel`, { method: "POST" });
    if (!res.ok) return setError((await res.json()).error ?? "Cancel failed");
    await loadBookings();
    if (search) await runSearch(search.checkIn, search.checkOut, category);
  }

  return (
    <main>
      <h1>Nimba Stay</h1>

      <form onSubmit={onSearch}>
        <label>
          Check-in <input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
        </label>{" "}
        <label>
          Check-out <input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
        </label>{" "}
        <label>
          Category{" "}
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All</option>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>{" "}
        <button type="submit">Find rooms</button>
      </form>

      {error && (
        <p role="alert" style={{ color: "crimson" }}>
          {error}
        </p>
      )}
      {info && <p style={{ color: "green" }}>{info}</p>}

      {search && (
        <section>
          <h2>
            Free rooms ({search.nights} night{search.nights === 1 ? "" : "s"})
          </h2>
          {search.rooms.length === 0 ? (
            <p>No rooms free for these dates.</p>
          ) : (
            <form onSubmit={onBook}>
              <table cellPadding={6}>
                <thead>
                  <tr>
                    <th />
                    <th align="left">Room</th>
                    <th align="left">Category</th>
                    <th align="right">Per night</th>
                    <th align="right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {search.rooms.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <input
                          type="radio"
                          name="room"
                          checked={roomId === r.id}
                          onChange={() => setRoomId(r.id)}
                          aria-label={`Select room ${r.number}`}
                        />
                      </td>
                      <td>{r.number}</td>
                      <td>{r.category}</td>
                      <td align="right">₹{r.pricePerNight}</td>
                      <td align="right">₹{r.totalPrice}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p>
                <label>
                  Guest name <input value={guestName} onChange={(e) => setGuestName(e.target.value)} />
                </label>{" "}
                <label>
                  Phone{" "}
                  <input
                    value={phone}
                    inputMode="numeric"
                    placeholder="10 digits"
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </label>{" "}
                <button type="submit" disabled={roomId === null}>
                  Book
                </button>
              </p>
            </form>
          )}
        </section>
      )}

      <section>
        <h2>Bookings</h2>
        {bookings.length === 0 ? (
          <p>No bookings yet.</p>
        ) : (
          <table cellPadding={6}>
            <thead>
              <tr>
                <th align="left">Room</th>
                <th align="left">Guest</th>
                <th align="left">Phone</th>
                <th align="left">Stay</th>
                <th align="left">Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id} style={{ opacity: b.status === "cancelled" ? 0.5 : 1 }}>
                  <td>{b.roomNumber}</td>
                  <td>{b.guestName}</td>
                  <td>{b.phone}</td>
                  <td>
                    {b.checkIn} → {b.checkOut}
                  </td>
                  <td>{b.status}</td>
                  <td>{b.status === "confirmed" && <button onClick={() => onCancel(b.id)}>Cancel</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
