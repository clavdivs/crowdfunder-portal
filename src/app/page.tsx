import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-16">
        <div className="flex flex-col items-center text-center space-y-8">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Investor Statement Portal
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground">
            View your beneficial ownership, track dilution, and download your investor statements.
          </p>

          <div className="grid gap-6 md:grid-cols-2 mt-8">
            <Card className="w-full max-w-sm">
              <CardHeader>
                <CardTitle>Investors</CardTitle>
                <CardDescription>
                  Access your holdings and download statements
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/investor">
                  <Button className="w-full">Investor Login</Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="w-full max-w-sm">
              <CardHeader>
                <CardTitle>Admin</CardTitle>
                <CardDescription>
                  Manage rounds, investors, and financing events
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/admin/login">
                  <Button variant="outline" className="w-full">Admin Login</Button>
                </Link>
              </CardContent>
            </Card>
          </div>

          <div className="mt-12">
            <Link href="/contact" className="text-sm text-muted-foreground hover:underline">
              Need help? Contact us
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
