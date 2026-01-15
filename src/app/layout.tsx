import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Investor Statement Portal",
  description: "Self-serve investor statement portal for crowdfunding investors",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="antialiased font-sans">
        {children}
      </body>
    </html>
  )
}
