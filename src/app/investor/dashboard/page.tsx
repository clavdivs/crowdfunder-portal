"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { db } from "@/lib/firebase/client"
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
} from "firebase/firestore"
import type { Round, Allocation, FinancingEvent, Company } from "@/types"
import {
  calculateDilution,
  calculateInvestorPercentNow,
  calculateImpliedValue,
  formatPercent,
  formatGbp,
} from "@/lib/dilution"

interface HoldingData {
  round: Round
  company: Company
  allocation: Allocation
  dilutionResult: {
    crowdPercentNow: number
    dilutionMultiplier: number
    latestValuationGbp?: number
    events: FinancingEvent[]
  }
  investorPercentNow: number
  impliedValue?: number
}

export default function InvestorDashboardPage() {
  const { user } = useAuth()
  const [holdings, setHoldings] = useState<HoldingData[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (user?.email) {
      loadHoldings(user.email)
    }
  }, [user?.email])

  const loadHoldings = async (email: string) => {
    try {
      const normalizedEmail = email.toLowerCase()

      // Get all rounds
      const roundsSnap = await getDocs(collection(db, "rounds"))
      const rounds = roundsSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Round[]

      // Get all companies
      const companiesSnap = await getDocs(collection(db, "companies"))
      const companies = companiesSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Company[]

      // Get all financing events
      const eventsSnap = await getDocs(
        query(collection(db, "financingEvents"), orderBy("eventDate", "asc"))
      )
      const allEvents = eventsSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as FinancingEvent[]

      // Find allocations for this investor across all rounds
      const holdingsData: HoldingData[] = []

      for (const round of rounds) {
        if (round.status !== "allocated") continue

        // Check if investor has allocation in this round
        const allocationsSnap = await getDocs(
          query(
            collection(db, "rounds", round.id, "allocations"),
            where("investorEmail", "==", normalizedEmail)
          )
        )

        if (allocationsSnap.empty) continue

        const allocation = {
          id: allocationsSnap.docs[0].id,
          ...allocationsSnap.docs[0].data(),
        } as Allocation

        const company = companies.find((c) => c.id === round.companyId)
        if (!company) continue

        // Get financing events for this company
        const companyEvents = allEvents.filter((e) => e.companyId === round.companyId)

        // Calculate dilution
        const dilutionResult = calculateDilution(
          round.crowdPercentAtClose,
          companyEvents
        )

        // Calculate investor's current position
        const investorPercentNow = calculateInvestorPercentNow(
          dilutionResult.crowdPercentNow,
          allocation.shareOfNominee
        )

        const impliedValue = dilutionResult.latestValuationGbp
          ? calculateImpliedValue(investorPercentNow, dilutionResult.latestValuationGbp)
          : undefined

        holdingsData.push({
          round,
          company,
          allocation,
          dilutionResult,
          investorPercentNow,
          impliedValue,
        })
      }

      setHoldings(holdingsData)
    } catch (error) {
      console.error("Error loading holdings:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDownloadPdf = async (holding: HoldingData) => {
    // For now, just alert - we'll implement PDF generation later
    alert("PDF generation will be implemented in the next phase")
  }

  if (isLoading) {
    return <p>Loading your holdings...</p>
  }

  if (holdings.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Your Holdings</h1>
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">
              No holdings found for {user?.email}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              If you believe this is an error, please contact us.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Calculate totals
  const totalInvested = holdings.reduce(
    (sum, h) => sum + h.allocation.investedAmountGbpSnapshot,
    0
  )
  const totalImpliedValue = holdings.reduce(
    (sum, h) => sum + (h.impliedValue || 0),
    0
  )

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Your Holdings</h1>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Invested</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatGbp(totalInvested)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Holdings</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{holdings.length}</p>
          </CardContent>
        </Card>
        {totalImpliedValue > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Implied Value</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatGbp(totalImpliedValue)}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Holdings Detail */}
      {holdings.map((holding) => (
        <Card key={holding.round.id}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{holding.round.roundName}</CardTitle>
                <CardDescription>
                  {holding.company.legalName} &bull; Nominee: {holding.round.nomineeName}
                </CardDescription>
              </div>
              <Button variant="outline" onClick={() => handleDownloadPdf(holding)}>
                Download Statement
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Investment Details */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-sm text-muted-foreground">Your Investment</p>
                <p className="text-lg font-semibold">
                  {formatGbp(holding.allocation.investedAmountGbpSnapshot)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Share of Nominee Pool</p>
                <p className="text-lg font-semibold">
                  {formatPercent(holding.allocation.shareOfNominee)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">% at Close</p>
                <p className="text-lg font-semibold">
                  {formatPercent(holding.allocation.companyPercentAtClose)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Current % (after dilution)</p>
                <p className="text-lg font-semibold">
                  {formatPercent(holding.investorPercentNow)}
                </p>
              </div>
            </div>

            {/* Valuation */}
            {holding.impliedValue && (
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Implied Value (based on latest valuation of{" "}
                      {formatGbp(holding.dilutionResult.latestValuationGbp!)})
                    </p>
                    <p className="text-xl font-bold">{formatGbp(holding.impliedValue)}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Dilution Events */}
            {holding.dilutionResult.events.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Dilution Events</p>
                <div className="border rounded-md overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-4 py-2 text-left">Date</th>
                        <th className="px-4 py-2 text-left">Investor</th>
                        <th className="px-4 py-2 text-right">% Sold</th>
                        <th className="px-4 py-2 text-right">Valuation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {holding.dilutionResult.events.map((event) => (
                        <tr key={event.id} className="border-t">
                          <td className="px-4 py-2">
                            {event.eventDate.toDate().toLocaleDateString()}
                          </td>
                          <td className="px-4 py-2">{event.investorName}</td>
                          <td className="px-4 py-2 text-right">
                            {formatPercent(event.percentSold)}
                          </td>
                          <td className="px-4 py-2 text-right">
                            {event.postMoneyValuationGbp
                              ? formatGbp(event.postMoneyValuationGbp)
                              : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Cumulative dilution:{" "}
                  {formatPercent(1 - holding.dilutionResult.dilutionMultiplier)} &bull;
                  Crowd pool now: {formatPercent(holding.dilutionResult.crowdPercentNow)}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
