"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { db } from "@/lib/firebase/client"
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  Timestamp,
} from "firebase/firestore"
import type { Company, Round } from "@/types"

export default function AdminRoundsPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [rounds, setRounds] = useState<Round[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showCompanyForm, setShowCompanyForm] = useState(false)
  const [showRoundForm, setShowRoundForm] = useState(false)

  // Company form state
  const [companyName, setCompanyName] = useState("")

  // Round form state
  const [selectedCompanyId, setSelectedCompanyId] = useState("")
  const [roundName, setRoundName] = useState("")
  const [nomineeName, setNomineeName] = useState("")
  const [crowdPercent, setCrowdPercent] = useState("")

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      // Load companies
      const companiesSnap = await getDocs(
        query(collection(db, "companies"), orderBy("createdAt", "desc"))
      )
      const companiesData = companiesSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Company[]
      setCompanies(companiesData)

      // Load rounds
      const roundsSnap = await getDocs(
        query(collection(db, "rounds"), orderBy("createdAt", "desc"))
      )
      const roundsData = roundsSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Round[]
      setRounds(roundsData)
    } catch (error) {
      console.error("Error loading data:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await addDoc(collection(db, "companies"), {
        legalName: companyName,
        createdAt: Timestamp.now(),
      })
      setCompanyName("")
      setShowCompanyForm(false)
      loadData()
    } catch (error) {
      console.error("Error creating company:", error)
    }
  }

  const handleCreateRound = async (e: React.FormEvent) => {
    e.preventDefault()
    const percentValue = parseFloat(crowdPercent) / 100
    if (isNaN(percentValue) || percentValue <= 0 || percentValue >= 1) {
      alert("Crowd percent must be between 0 and 100 (exclusive)")
      return
    }

    try {
      await addDoc(collection(db, "rounds"), {
        companyId: selectedCompanyId,
        roundName,
        nomineeName,
        status: "draft",
        crowdPercentAtClose: percentValue,
        createdAt: Timestamp.now(),
        allocationVersion: 0,
      })
      setRoundName("")
      setNomineeName("")
      setCrowdPercent("")
      setSelectedCompanyId("")
      setShowRoundForm(false)
      loadData()
    } catch (error) {
      console.error("Error creating round:", error)
    }
  }

  const getCompanyName = (companyId: string) => {
    return companies.find((c) => c.id === companyId)?.legalName || "Unknown"
  }

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      draft: "bg-yellow-100 text-yellow-800",
      closed: "bg-blue-100 text-blue-800",
      allocated: "bg-green-100 text-green-800",
    }
    return (
      <span
        className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || "bg-gray-100"}`}
      >
        {status}
      </span>
    )
  }

  if (isLoading) {
    return <p>Loading...</p>
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Crowdfund Rounds</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowCompanyForm(true)}>
            + Company
          </Button>
          <Button onClick={() => setShowRoundForm(true)} disabled={companies.length === 0}>
            + Round
          </Button>
        </div>
      </div>

      {/* Create Company Form */}
      {showCompanyForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create Company</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateCompany} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="companyName">Legal Name</Label>
                <Input
                  id="companyName"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g., Acme Corp Ltd"
                  required
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit">Create</Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCompanyForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Create Round Form */}
      {showRoundForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create Round</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateRound} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="company">Company</Label>
                <select
                  id="company"
                  value={selectedCompanyId}
                  onChange={(e) => setSelectedCompanyId(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  required
                >
                  <option value="">Select company...</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.legalName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="roundName">Round Name</Label>
                <Input
                  id="roundName"
                  value={roundName}
                  onChange={(e) => setRoundName(e.target.value)}
                  placeholder="e.g., Seed Round 2024"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nomineeName">Nominee/SPV Name</Label>
                <Input
                  id="nomineeName"
                  value={nomineeName}
                  onChange={(e) => setNomineeName(e.target.value)}
                  placeholder="e.g., Acme Nominee Ltd"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="crowdPercent">Crowd Ownership at Close (%)</Label>
                <Input
                  id="crowdPercent"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max="99.99"
                  value={crowdPercent}
                  onChange={(e) => setCrowdPercent(e.target.value)}
                  placeholder="e.g., 10 for 10%"
                  required
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit">Create</Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowRoundForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Companies List */}
      {companies.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Companies</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {companies.map((company) => (
                <div key={company.id} className="py-3 flex justify-between items-center">
                  <span className="font-medium">{company.legalName}</span>
                  <span className="text-sm text-muted-foreground">
                    {rounds.filter((r) => r.companyId === company.id).length} round(s)
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rounds List */}
      {rounds.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No rounds yet. Create a company first, then add a round.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {rounds.map((round) => (
            <Card key={round.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{round.roundName}</CardTitle>
                    <CardDescription>
                      {getCompanyName(round.companyId)} &bull; Nominee: {round.nomineeName}
                    </CardDescription>
                  </div>
                  {getStatusBadge(round.status)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Crowd ownership at close:{" "}
                    <span className="font-medium text-foreground">
                      {(round.crowdPercentAtClose * 100).toFixed(2)}%
                    </span>
                    {round.totalInvestedGbp && (
                      <>
                        {" "}&bull; Total invested:{" "}
                        <span className="font-medium text-foreground">
                          £{round.totalInvestedGbp.toLocaleString()}
                        </span>
                      </>
                    )}
                  </div>
                  <Link href={`/admin/rounds/${round.id}`}>
                    <Button variant="outline" size="sm">
                      Manage
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
