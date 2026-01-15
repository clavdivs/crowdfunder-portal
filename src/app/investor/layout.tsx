"use client"

import { useAuth } from "@/lib/auth-context"
import { useRouter, usePathname } from "next/navigation"
import { useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function InvestorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, isLoading, logout } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  // Allow login page without auth
  const isLoginPage = pathname === "/investor"

  useEffect(() => {
    if (!isLoading && !isLoginPage && user?.role !== "investor") {
      router.push("/investor")
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
  if (user?.role !== "investor") {
    return null
  }

  const handleLogout = () => {
    logout()
    router.push("/investor")
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/investor/dashboard" className="font-semibold">
              Investor Portal
            </Link>
            <span className="text-sm text-muted-foreground">{user.email}</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/contact" className="text-sm text-muted-foreground hover:text-foreground">
              Contact Us
            </Link>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              Logout
            </Button>
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">{children}</main>
    </div>
  )
}
