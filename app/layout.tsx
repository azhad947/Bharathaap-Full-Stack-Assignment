import type { ReactNode } from "react";

export const metadata = { title: "Nimba Stay" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", maxWidth: 820, margin: "24px auto", padding: "0 16px" }}>
        {children}
      </body>
    </html>
  );
}
