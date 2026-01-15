"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from "react"

// Hardcoded test credentials
const TEST_CREDENTIALS = {
  username: "ccuser",
  password: "ccadminpa55",
}

// Mock investor emails for testing
const TEST_INVESTORS = [
  "investor.a@example.com",
  "investor.b@example.com",
  "investor.c@example.com",
]

type UserRole = "admin" | "investor" | null

interface AuthUser {
  role: UserRole
  email?: string
}

interface AuthContextType {
  user: AuthUser | null
  isLoading: boolean
  loginAsAdmin: (username: string, password: string) => boolean
  loginAsInvestor: (email: string) => boolean
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Check for existing session on mount
  useEffect(() => {
    const stored = localStorage.getItem("mock_auth")
    if (stored) {
      try {
        setUser(JSON.parse(stored))
      } catch {
        localStorage.removeItem("mock_auth")
      }
    }
    setIsLoading(false)
  }, [])

  const loginAsAdmin = (username: string, password: string): boolean => {
    if (
      username === TEST_CREDENTIALS.username &&
      password === TEST_CREDENTIALS.password
    ) {
      const authUser: AuthUser = { role: "admin", email: "admin@test.com" }
      setUser(authUser)
      localStorage.setItem("mock_auth", JSON.stringify(authUser))
      return true
    }
    return false
  }

  const loginAsInvestor = (email: string): boolean => {
    // For testing, accept any email (in prod this would send magic link)
    const normalizedEmail = email.toLowerCase().trim()
    if (normalizedEmail && normalizedEmail.includes("@")) {
      const authUser: AuthUser = { role: "investor", email: normalizedEmail }
      setUser(authUser)
      localStorage.setItem("mock_auth", JSON.stringify(authUser))
      return true
    }
    return false
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem("mock_auth")
  }

  return (
    <AuthContext.Provider
      value={{ user, isLoading, loginAsAdmin, loginAsInvestor, logout }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

// Test investor emails export for seeding
export { TEST_INVESTORS }
