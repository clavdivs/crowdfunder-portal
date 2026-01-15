"use client"

import { useAuth } from "@/lib/auth-context"
import { useRouter, usePathname } from "next/navigation"
import { useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, isLoading, logout } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  // Allow login page without auth
  const isLoginPage = pathname === "/admin/login"

  useEffect(() => {
    if (!isLoading && !isLoginPage && user?.role !== "admin") {
      router.push("/admin/login")
    }
  }, [user, isLoading, isLoginPage, router])

  // Show login page without layout
  if (isLoginPage) {
    return <>{children}</>
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    )
  }

  // Not authenticated
  if (user?.role !== "admin") {
    return null
  }

  const handleLogout = () => {
    logout()
    router.push("/admin/login")
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <nav className="flex items-center gap-6">
            <Link href="/admin/rounds" className="font-semibold">
              Investor Portal Admin
            </Link>
            <Link
              href="/admin/rounds"
              className={`text-sm ${pathname.startsWith("/admin/rounds") ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Rounds
            </Link>
            <Link
              href="/admin/financing-events"
              className={`text-sm ${pathname === "/admin/financing-events" ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Financing Events
            </Link>
            <Link
              href="/admin/exports"
              className={`text-sm ${pathname === "/admin/exports" ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Exports
            </Link>
          </nav>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            Logout
          </Button>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">{children}</main>
    </div>
  )
}
