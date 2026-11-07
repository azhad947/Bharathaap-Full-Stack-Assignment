"use client";

const DAYS = 14;

interface Room {
  id: number;
  number: string;
  category: string;
  status: "available" | "maintenance";
}

interface Booking {
  id: number;
  roomNumber: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  status: "confirmed" | "cancelled";
}

interface Props {
  rooms: Room[];
  bookings: Booking[];
}

function addDays(base: Date, n: number) {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

function toYMD(d: Date) {
  return d.toISOString().slice(0, 10);
}

const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export default function RoomTimeline({ rooms, bookings }: Props) {
  const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
  const days = Array.from({ length: DAYS }, (_, i) => addDays(today, i));

  // confirmed bookings only, indexed by roomNumber
  const confirmed = bookings.filter((b) => b.status === "confirmed");

  return (
    <div className="tl-wrap">
      {/* header row: room label col + day cols */}
      <div className="tl-grid" style={{ "--cols": DAYS } as React.CSSProperties}>
        <div className="tl-corner" />
        {days.map((d) => {
          const isToday = toYMD(d) === toYMD(today);
          return (
            <div key={toYMD(d)} className={`tl-day-header${isToday ? " tl-today" : ""}`}>
              <span className="tl-day-name">{DAY_LABELS[d.getUTCDay()]}</span>
              <span className="tl-day-num">{d.getUTCDate()}</span>
            </div>
          );
        })}

        {rooms.map((room) => {
          const roomBookings = confirmed.filter((b) => b.roomNumber === room.number);

          return [
            // room label
            <div key={`label-${room.id}`} className="tl-room-label">
              <span className="tl-room-num">{room.number}</span>
              {room.status === "maintenance" && <span className="tl-maint">M</span>}
            </div>,

            // day cells + booking blocks for this room
            ...days.map((d) => {
              const ymd = toYMD(d);
              const isToday = ymd === toYMD(today);

              // find a booking that covers this day (checkIn <= day < checkOut)
              const booking = roomBookings.find((b) => b.checkIn <= ymd && b.checkOut > ymd);

              // only render the block on the first day of the booking that's visible
              const isBlockStart = booking && (booking.checkIn === ymd || toYMD(today) === ymd && booking.checkIn < ymd);

              // how many days does the block span within our 14-day window?
              const blockSpan = booking && isBlockStart
                ? Math.min(
                    days.filter((dd) => dd >= d && booking.checkIn <= toYMD(dd) && booking.checkOut > toYMD(dd)).length,
                    DAYS
                  )
                : 0;

              return (
                <div
                  key={`${room.id}-${ymd}`}
                  className={[
                    "tl-cell",
                    room.status === "maintenance" ? "tl-cell-maint" : "",
                    isToday ? "tl-cell-today" : "",
                    booking && !isBlockStart ? "tl-cell-booked" : "",
                  ].join(" ").trim()}
                >
                  {isBlockStart && booking && (
                    <div
                      className="tl-block"
                      style={{ width: `calc(${blockSpan * 100}% + ${blockSpan - 1}px)` }}
                      title={`${booking.guestName} · ${booking.checkIn} → ${booking.checkOut}`}
                    >
                      <span className="tl-block-name">{booking.guestName.split(" ")[0]}</span>
                    </div>
                  )}
                </div>
              );
            }),
          ];
        })}
      </div>

      <div className="tl-legend">
        <span className="tl-legend-item"><span className="tl-legend-dot tl-legend-booked" />Booked</span>
        <span className="tl-legend-item"><span className="tl-legend-dot tl-legend-free" />Free</span>
        <span className="tl-legend-item"><span className="tl-legend-dot tl-legend-maint" />Maintenance</span>
      </div>
    </div>
  );
}
