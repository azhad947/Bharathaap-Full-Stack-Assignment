"use client";

import { useCallback, useEffect, useState } from "react";
import { CATEGORIES } from "../lib/constants";
import RoomTimeline from "./components/RoomTimeline";

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
interface Room {
  id: number;
  number: string;
  category: string;
  status: "available" | "maintenance";
}

const categoryClass: Record<string, string> = {
  Standard: "badge-standard",
  Deluxe: "badge-deluxe",
  Suite: "badge-suite",
};

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
  const [rooms, setRooms] = useState<Room[]>([]);

  const loadBookings = useCallback(async () => {
    const res = await fetch("/api/bookings");
    if (res.ok) setBookings(await res.json());
  }, []);

  useEffect(() => {
    loadBookings();
    fetch("/api/rooms").then((r) => { if (r.ok) r.json().then(setRooms); });
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
    setInfo(`Booked room ${data.roomNumber} · ${data.checkIn} → ${data.checkOut} · ₹${data.totalPrice}`);
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
    <div className="page">
      <div className="header">
        <h1>Nimba Stay</h1>
        <p>Front-desk room booking · Nimba Nature Cure</p>
      </div>

      <div className="card">
        <div className="card-title">Find available rooms</div>
        <form onSubmit={onSearch}>
          <div className="search-row">
            <div className="field">
              <label>Check-in</label>
              <input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
            </div>
            <div className="field">
              <label>Check-out</label>
              <input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
            </div>
            <div className="field">
              <label>Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">All categories</option>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <button className="btn btn-primary" type="submit">Search</button>
          </div>
        </form>
      </div>

      {error && <div className="alert alert-error" role="alert">{error}</div>}
      {info  && <div className="alert alert-success">{info}</div>}

      {/* Available rooms */}
      {search && (
        <div className="card">
          <div className="card-title">
            Available rooms
            <span className="nights-tag">{search.nights} night{search.nights === 1 ? "" : "s"}</span>
          </div>
          {search.rooms.length === 0 ? (
            <p className="empty">No rooms available for these dates.</p>
          ) : (
            <form onSubmit={onBook}>
              <table className="rooms-table">
                <thead>
                  <tr>
                    <th style={{ width: 36 }} />
                    <th>Room</th>
                    <th>Category</th>
                    <th className="right">Per night</th>
                    <th className="right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {search.rooms.map((r) => (
                    <tr
                      key={r.id}
                      className={roomId === r.id ? "selected" : ""}
                      onClick={() => setRoomId(r.id)}
                    >
                      <td>
                        <input
                          type="radio"
                          name="room"
                          checked={roomId === r.id}
                          onChange={() => setRoomId(r.id)}
                          aria-label={`Select room ${r.number}`}
                        />
                      </td>
                      <td><strong>{r.number}</strong></td>
                      <td>
                        <span className={`badge ${categoryClass[r.category] ?? "badge-standard"}`}>
                          {r.category}
                        </span>
                      </td>
                      <td className="right">₹{r.pricePerNight.toLocaleString()}</td>
                      <td className="right"><strong>₹{r.totalPrice.toLocaleString()}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="guest-row">
                <div className="field">
                  <label>Guest name</label>
                  <input
                    value={guestName}
                    placeholder="Full name"
                    onChange={(e) => setGuestName(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>Phone</label>
                  <input
                    value={phone}
                    inputMode="numeric"
                    placeholder="10-digit number"
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                <button className="btn btn-primary" type="submit" disabled={roomId === null}>
                  Confirm booking
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Room timeline */}
      {rooms.length > 0 && (
        <div className="card">
          <div className="card-title">14-day room timeline</div>
          <RoomTimeline rooms={rooms} bookings={bookings} />
        </div>
      )}

      {/* Bookings list */}
      <div className="card">
        <div className="card-title">All bookings</div>
        {bookings.length === 0 ? (
          <p className="empty">No bookings yet.</p>
        ) : (
          <table className="bookings-table">
            <thead>
              <tr>
                <th>Room</th>
                <th>Guest</th>
                <th>Phone</th>
                <th>Stay</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id} className={b.status === "cancelled" ? "cancelled" : ""}>
                  <td><strong>{b.roomNumber}</strong></td>
                  <td>{b.guestName}</td>
                  <td>{b.phone}</td>
                  <td>{b.checkIn} → {b.checkOut}</td>
                  <td>
                    <span className={b.status === "confirmed" ? "status-confirmed" : "status-cancelled"}>
                      {b.status}
                    </span>
                  </td>
                  <td>
                    {b.status === "confirmed" && (
                      <button className="btn btn-danger" onClick={() => onCancel(b.id)}>Cancel</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
