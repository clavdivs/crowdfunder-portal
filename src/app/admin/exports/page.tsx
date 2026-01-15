"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { db } from "@/lib/firebase/client"
import { collection, getDocs, query, orderBy } from "firebase/firestore"
import type { Company, Round, Allocation, FinancingEvent } from "@/types"
import { calculateDilution, formatPercent, formatGbp } from "@/lib/dilution"

export default function AdminExportsPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [rounds, setRounds] = useState<Round[]>([])
  const [isLoading, setIsLoading] = useState(true)

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

      const roundsSnap = await getDocs(
        query(collection(db, "rounds"), orderBy("createdAt", "desc"))
      )
      setRounds(
        roundsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Round[]
      )
    } catch (error) {
      console.error("Error loading data:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleExportCapTable = async (companyId: string) => {
    // For now, just alert - PDF generation will be added later
    alert("Cap table PDF export will be implemented in the next phase")
  }

  const handleExportBeneficialSchedule = async (roundId: string) => {
    // For now, just alert - PDF generation will be added later
    alert("Beneficial owner schedule PDF export will be implemented in the next phase")
  }

  const handleExportAllAllocations = async (roundId: string) => {
    try {
      const round = rounds.find((r) => r.id === roundId)
      if (!round) return

      const allocationsSnap = await getDocs(
        collection(db, "rounds", roundId, "allocations")
      )
      const allocations = allocationsSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Allocation[]

      // Get financing events for dilution calculation
      const eventsSnap = await getDocs(
        query(
          collection(db, "financingEvents"),
          orderBy("eventDate", "asc")
        )
      )
      const events = eventsSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as FinancingEvent)
        .filter((e) => e.companyId === round.companyId)

      const dilutionResult = calculateDilution(round.crowdPercentAtClose, events)

      // Generate CSV
      const headers = [
        "Name",
        "Email",
        "Invested (GBP)",
        "Share of Nominee",
        "% at Close",
        "% Now (Diluted)",
        "Implied Value (GBP)",
      ]

      const rows = allocations.map((alloc) => {
        const percentNow = dilutionResult.crowdPercentNow * alloc.shareOfNominee
        const impliedValue = dilutionResult.latestValuationGbp
          ? percentNow * dilutionResult.latestValuationGbp
          : ""

        return [
          alloc.investorName,
          alloc.investorEmail,
          alloc.investedAmountGbpSnapshot.toString(),
          (alloc.shareOfNominee * 100).toFixed(4) + "%",
          (alloc.companyPercentAtClose * 100).toFixed(4) + "%",
          (percentNow * 100).toFixed(4) + "%",
          impliedValue ? impliedValue.toFixed(2) : "",
        ]
      })

      const csv = [headers, ...rows].map((row) => row.join(",")).join("\n")

      // Download
      const blob = new Blob([csv], { type: "text/csv" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${round.roundName.replace(/\s+/g, "_")}_allocations.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Error exporting:", error)
    }
  }

  if (isLoading) {
    return <p>Loading...</p>
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Exports</h1>
        <p className="text-muted-foreground">
          Download cap tables, beneficial owner schedules, and investor statements
        </p>
      </div>

      {/* Cap Table Exports */}
      <Card>
        <CardHeader>
          <CardTitle>Cap Table Summary</CardTitle>
          <CardDescription>
            Top-level cap table showing nominee + other shareholders
          </CardDescription>
        </CardHeader>
        <CardContent>
          {companies.length === 0 ? (
            <p className="text-sm text-muted-foreground">No companies yet</p>
          ) : (
            <div className="space-y-2">
              {companies.map((company) => (
                <div
                  key={company.id}
                  className="flex items-center justify-between p-3 border rounded-md"
                >
                  <span className="font-medium">{company.legalName}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExportCapTable(company.id)}
                  >
                    Export PDF
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Beneficial Owner Schedule */}
      <Card>
        <CardHeader>
          <CardTitle>Beneficial Owner Schedule</CardTitle>
          <CardDescription>
            Full list of beneficial owners behind each nominee
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rounds.filter((r) => r.status === "allocated").length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No allocated rounds yet
            </p>
          ) : (
            <div className="space-y-2">
              {rounds
                .filter((r) => r.status === "allocated")
                .map((round) => {
                  const company = companies.find(
                    (c) => c.id === round.companyId
                  )
                  return (
                    <div
                      key={round.id}
                      className="flex items-center justify-between p-3 border rounded-md"
                    >
                      <div>
                        <span className="font-medium">{round.roundName}</span>
                        <span className="text-sm text-muted-foreground ml-2">
                          ({company?.legalName})
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleExportAllAllocations(round.id)}
                        >
                          Export CSV
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleExportBeneficialSchedule(round.id)}
                        >
                          Export PDF
                        </Button>
                      </div>
                    </div>
                  )
                })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Contact Messages */}
      <ContactMessages />
    </div>
  )
}

function ContactMessages() {
  const [messages, setMessages] = useState<Array<{
    id: string
    name: string
    email: string
    message: string
    status: string
    createdAt: { toDate: () => Date }
  }>>([])

  useEffect(() => {
    loadMessages()
  }, [])

  const loadMessages = async () => {
    try {
      const snap = await getDocs(
        query(collection(db, "contactMessages"), orderBy("createdAt", "desc"))
      )
      setMessages(
        snap.docs.map((d) => ({ id: d.id, ...d.data() })) as typeof messages
      )
    } catch (error) {
      console.error("Error loading messages:", error)
    }
  }

  if (messages.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Contact Messages</CardTitle>
        <CardDescription>{messages.length} message(s)</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {messages.map((msg) => (
            <div key={msg.id} className="p-4 border rounded-md space-y-2">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium">{msg.name}</p>
                  <p className="text-sm text-muted-foreground">{msg.email}</p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {msg.createdAt.toDate().toLocaleDateString()}
                </span>
              </div>
              <p className="text-sm">{msg.message}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
