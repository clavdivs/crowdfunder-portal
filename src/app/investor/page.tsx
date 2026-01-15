"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function InvestorLoginPage() {
  const [email, setEmail] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const { loginAsInvestor } = useAuth()
  const router = useRouter()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // In production, this would send a magic link
    // For testing, we directly log in
    if (loginAsInvestor(email)) {
      router.push("/investor/dashboard")
    } else {
      setSubmitted(true)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Investor Access</CardTitle>
          <CardDescription>
            Enter your email to access your investor statement
          </CardDescription>
        </CardHeader>
        <CardContent>
          {submitted ? (
            <div className="text-center space-y-4">
              <p className="text-sm text-muted-foreground">
                If you&apos;re on the register, you&apos;ll receive a login link at your email.
              </p>
              <p className="text-xs text-muted-foreground">
                (For testing: any valid email will work)
              </p>
              <Button variant="outline" onClick={() => setSubmitted(false)}>
                Try another email
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                />
              </div>
              <Button type="submit" className="w-full">
                Request Access
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                For testing: Enter any email to access the dashboard
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
