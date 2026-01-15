"use client"

import { useState, useEffect } from "react"
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
import type { Company, FinancingEvent } from "@/types"
import {
  derivePercentSold,
  formatPercent,
  formatGbp,
  calculateDilutionMultiplier,
} from "@/lib/dilution"

type InputMode = "PERCENT" | "INVESTMENT_AND_VALUATION"

export default function FinancingEventsPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [events, setEvents] = useState<FinancingEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  // Form state
  const [selectedCompanyId, setSelectedCompanyId] = useState("")
  const [eventDate, setEventDate] = useState("")
  const [investorName, setInvestorName] = useState("")
  const [inputMode, setInputMode] = useState<InputMode>("PERCENT")
  const [percentSold, setPercentSold] = useState("")
  const [investmentAmount, setInvestmentAmount] = useState("")
  const [postMoneyValuation, setPostMoneyValuation] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const companiesSnap = await getDocs(
        query(collection(db, "companies"), orderBy("createdAt", "desc"))
      )
      setCompanies(
        companiesSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Company[]
      )

      const eventsSnap = await getDocs(
        query(collection(db, "financingEvents"), orderBy("eventDate", "desc"))
      )
      setEvents(
        eventsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as FinancingEvent[]
      )
    } catch (error) {
      console.error("Error loading data:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    try {
      let finalPercentSold: number

      if (inputMode === "PERCENT") {
        finalPercentSold = parseFloat(percentSold) / 100
        if (isNaN(finalPercentSold) || finalPercentSold <= 0 || finalPercentSold >= 1) {
          setError("Percent sold must be between 0 and 100 (exclusive)")
          return
        }
      } else {
        const invAmount = parseFloat(investmentAmount.replace(/[£,]/g, ""))
        const valuation = parseFloat(postMoneyValuation.replace(/[£,]/g, ""))
        if (isNaN(invAmount) || isNaN(valuation) || invAmount <= 0 || valuation <= 0) {
          setError("Investment amount and valuation must be positive numbers")
          return
        }
        finalPercentSold = derivePercentSold(invAmount, valuation)
      }

      const eventData: Omit<FinancingEvent, "id"> = {
        companyId: selectedCompanyId,
        eventDate: Timestamp.fromDate(new Date(eventDate)),
        investorName,
        inputMode,
        percentSold: finalPercentSold,
        createdAt: Timestamp.now(),
      }

      // Add optional fields
      if (inputMode === "INVESTMENT_AND_VALUATION") {
        eventData.investmentAmountGbp = parseFloat(investmentAmount.replace(/[£,]/g, ""))
        eventData.postMoneyValuationGbp = parseFloat(postMoneyValuation.replace(/[£,]/g, ""))
      } else if (postMoneyValuation) {
        eventData.postMoneyValuationGbp = parseFloat(postMoneyValuation.replace(/[£,]/g, ""))
      }

      await addDoc(collection(db, "financingEvents"), eventData)

      // Reset form
      setSelectedCompanyId("")
      setEventDate("")
      setInvestorName("")
      setPercentSold("")
      setInvestmentAmount("")
      setPostMoneyValuation("")
      setShowForm(false)
      loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    }
  }

  const getCompanyName = (companyId: string) => {
    return companies.find((c) => c.id === companyId)?.legalName || "Unknown"
  }

  const getCompanyEvents = (companyId: string) => {
    return events
      .filter((e) => e.companyId === companyId)
      .sort((a, b) => a.eventDate.toDate().getTime() - b.eventDate.toDate().getTime())
  }

  if (isLoading) {
    return <p>Loading...</p>
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Financing Events</h1>
          <p className="text-muted-foreground">
            Track dilution from subsequent funding rounds
          </p>
        </div>
        <Button onClick={() => setShowForm(true)} disabled={companies.length === 0}>
          + Add Event
        </Button>
      </div>

      {/* Add Event Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Add Financing Event</CardTitle>
            <CardDescription>
              Choose one input method to record the dilution
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
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
                  <Label htmlFor="eventDate">Event Date</Label>
                  <Input
                    id="eventDate"
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="investorName">Investor/Fund Name</Label>
                <Input
                  id="investorName"
                  value={investorName}
                  onChange={(e) => setInvestorName(e.target.value)}
                  placeholder="e.g., Series A Ventures"
                  required
                />
              </div>

              {/* Input Mode Selection */}
              <div className="space-y-2">
                <Label>Input Method</Label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="inputMode"
                      value="PERCENT"
                      checked={inputMode === "PERCENT"}
                      onChange={() => setInputMode("PERCENT")}
                    />
                    <span className="text-sm">Enter % sold (recommended)</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="inputMode"
                      value="INVESTMENT_AND_VALUATION"
                      checked={inputMode === "INVESTMENT_AND_VALUATION"}
                      onChange={() => setInputMode("INVESTMENT_AND_VALUATION")}
                    />
                    <span className="text-sm">Enter investment + valuation</span>
                  </label>
                </div>
              </div>

              {inputMode === "PERCENT" ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="percentSold">Percent Sold (%)</Label>
                    <Input
                      id="percentSold"
                      type="number"
                      step="0.01"
                      min="0.01"
                      max="99.99"
                      value={percentSold}
                      onChange={(e) => setPercentSold(e.target.value)}
                      placeholder="e.g., 20 for 20%"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="valuation">
                      Post-Money Valuation (optional)
                    </Label>
                    <Input
                      id="valuation"
                      type="text"
                      value={postMoneyValuation}
                      onChange={(e) => setPostMoneyValuation(e.target.value)}
                      placeholder="e.g., 25000000"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="investment">Investment Amount (GBP)</Label>
                    <Input
                      id="investment"
                      type="text"
                      value={investmentAmount}
                      onChange={(e) => setInvestmentAmount(e.target.value)}
                      placeholder="e.g., 5000000"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="valuation2">Post-Money Valuation (GBP)</Label>
                    <Input
                      id="valuation2"
                      type="text"
                      value={postMoneyValuation}
                      onChange={(e) => setPostMoneyValuation(e.target.value)}
                      placeholder="e.g., 25000000"
                      required
                    />
                  </div>
                </div>
              )}

              {error && <p className="text-sm text-destructive">{error}</p>}

              <div className="flex gap-2">
                <Button type="submit">Add Event</Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Events by Company */}
      {companies.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No companies yet. Create a company in Rounds first.
          </CardContent>
        </Card>
      ) : (
        companies.map((company) => {
          const companyEvents = getCompanyEvents(company.id)
          const dilutionMultiplier =
            companyEvents.length > 0
              ? calculateDilutionMultiplier(companyEvents)
              : 1

          return (
            <Card key={company.id}>
              <CardHeader>
                <CardTitle>{company.legalName}</CardTitle>
                <CardDescription>
                  {companyEvents.length} financing event(s) &bull; Cumulative
                  dilution: {formatPercent(1 - dilutionMultiplier)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {companyEvents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No financing events recorded
                  </p>
                ) : (
                  <div className="border rounded-md overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted">
                        <tr>
                          <th className="px-4 py-2 text-left">Date</th>
                          <th className="px-4 py-2 text-left">Investor</th>
                          <th className="px-4 py-2 text-right">% Sold</th>
                          <th className="px-4 py-2 text-right">Investment</th>
                          <th className="px-4 py-2 text-right">Valuation</th>
                        </tr>
                      </thead>
                      <tbody>
                        {companyEvents.map((event) => (
                          <tr key={event.id} className="border-t">
                            <td className="px-4 py-2">
                              {event.eventDate.toDate().toLocaleDateString()}
                            </td>
                            <td className="px-4 py-2">{event.investorName}</td>
                            <td className="px-4 py-2 text-right">
                              {formatPercent(event.percentSold)}
                            </td>
                            <td className="px-4 py-2 text-right">
                              {event.investmentAmountGbp
                                ? formatGbp(event.investmentAmountGbp)
                                : "-"}
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
                )}
              </CardContent>
            </Card>
          )
        })
      )}
    </div>
  )
}
