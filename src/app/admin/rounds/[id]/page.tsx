"use client"

import { useState, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { db } from "@/lib/firebase/client"
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  getDocs,
  addDoc,
  writeBatch,
  query,
  orderBy,
  Timestamp,
} from "firebase/firestore"
import type { Round, Investment, Allocation, Company } from "@/types"
import { calculateAllocations, formatPercent, formatGbp } from "@/lib/dilution"

interface PageProps {
  params: Promise<{ id: string }>
}

export default function RoundDetailPage({ params }: PageProps) {
  const { id: roundId } = use(params)
  const router = useRouter()

  const [round, setRound] = useState<Round | null>(null)
  const [company, setCompany] = useState<Company | null>(null)
  const [investments, setInvestments] = useState<Investment[]>([])
  const [allocations, setAllocations] = useState<Allocation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvPreview, setCsvPreview] = useState<Array<{ name: string; email: string; amount: number }>>([])
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    loadRoundData()
  }, [roundId])

  const loadRoundData = async () => {
    try {
      // Load round
      const roundDoc = await getDoc(doc(db, "rounds", roundId))
      if (!roundDoc.exists()) {
        router.push("/admin/rounds")
        return
      }
      const roundData = { id: roundDoc.id, ...roundDoc.data() } as Round
      setRound(roundData)

      // Load company
      const companyDoc = await getDoc(doc(db, "companies", roundData.companyId))
      if (companyDoc.exists()) {
        setCompany({ id: companyDoc.id, ...companyDoc.data() } as Company)
      }

      // Load investments
      const investmentsSnap = await getDocs(
        query(
          collection(db, "rounds", roundId, "investments"),
          orderBy("createdAt", "desc")
        )
      )
      setInvestments(
        investmentsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Investment[]
      )

      // Load allocations
      const allocationsSnap = await getDocs(
        query(
          collection(db, "rounds", roundId, "allocations"),
          orderBy("createdAt", "desc")
        )
      )
      setAllocations(
        allocationsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Allocation[]
      )
    } catch (error) {
      console.error("Error loading round:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCsvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setCsvFile(file)

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      const lines = text.split("\n").filter((line) => line.trim())
      const header = lines[0].toLowerCase()

      // Simple CSV parsing (assumes: name, email, amount)
      const preview: Array<{ name: string; email: string; amount: number }> = []
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(",").map((v) => v.trim().replace(/^"|"$/g, ""))
        if (values.length >= 3) {
          const amount = parseFloat(values[2].replace(/[£,]/g, ""))
          if (!isNaN(amount) && amount > 0) {
            preview.push({
              name: values[0],
              email: values[1].toLowerCase(),
              amount,
            })
          }
        }
      }
      setCsvPreview(preview)
    }
    reader.readAsText(file)
  }

  const handleImportCsv = async () => {
    if (csvPreview.length === 0) return
    setIsProcessing(true)

    try {
      const batch = writeBatch(db)
      const investmentsRef = collection(db, "rounds", roundId, "investments")

      for (const inv of csvPreview) {
        const docRef = doc(investmentsRef)
        batch.set(docRef, {
          investorName: inv.name,
          investorEmail: inv.email,
          amountGbp: inv.amount,
          source: "CSV",
          createdAt: Timestamp.now(),
        })
      }

      await batch.commit()
      setCsvFile(null)
      setCsvPreview([])
      loadRoundData()
    } catch (error) {
      console.error("Error importing CSV:", error)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleCloseRound = async () => {
    if (!round || round.status !== "draft") return
    if (!confirm("Close this round? This marks it ready for allocation.")) return

    try {
      await updateDoc(doc(db, "rounds", roundId), {
        status: "closed",
        closeDate: Timestamp.now(),
      })
      loadRoundData()
    } catch (error) {
      console.error("Error closing round:", error)
    }
  }

  const handleAllocate = async () => {
    if (!round || round.status !== "closed" || investments.length === 0) return
    if (!confirm("Allocate pro-rata shares? This will lock the allocations.")) return

    setIsProcessing(true)
    try {
      const allocationData = calculateAllocations(
        investments.map((inv) => ({
          investorEmail: inv.investorEmail,
          investorName: inv.investorName,
          amountGbp: inv.amountGbp,
        })),
        round.crowdPercentAtClose
      )

      const totalInvested = investments.reduce((sum, inv) => sum + inv.amountGbp, 0)
      const newVersion = (round.allocationVersion || 0) + 1

      // Write allocations
      const batch = writeBatch(db)
      const allocationsRef = collection(db, "rounds", roundId, "allocations")

      for (const alloc of allocationData) {
        const docRef = doc(allocationsRef)
        batch.set(docRef, {
          investorEmail: alloc.investorEmail,
          investorName: alloc.investorName,
          investedAmountGbpSnapshot: alloc.investedAmountGbp,
          shareOfNominee: alloc.shareOfNominee,
          companyPercentAtClose: alloc.companyPercentAtClose,
          allocationVersion: newVersion,
          createdAt: Timestamp.now(),
        })
      }

      // Update round status
      batch.update(doc(db, "rounds", roundId), {
        status: "allocated",
        totalInvestedGbp: totalInvested,
        allocationVersion: newVersion,
      })

      await batch.commit()
      loadRoundData()
    } catch (error) {
      console.error("Error allocating:", error)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleReopenRound = async () => {
    if (!round) return
    if (!confirm("Reopen this round? This will allow changes to investments.")) return

    try {
      await updateDoc(doc(db, "rounds", roundId), {
        status: "draft",
      })
      loadRoundData()
    } catch (error) {
      console.error("Error reopening round:", error)
    }
  }

  if (isLoading) {
    return <p>Loading...</p>
  }

  if (!round) {
    return <p>Round not found</p>
  }

  const totalInvested = investments.reduce((sum, inv) => sum + inv.amountGbp, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{round.roundName}</h1>
          <p className="text-muted-foreground">
            {company?.legalName} &bull; Nominee: {round.nomineeName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={round.status} />
          {round.status === "draft" && investments.length > 0 && (
            <Button onClick={handleCloseRound}>Close Round</Button>
          )}
          {round.status === "closed" && (
            <Button onClick={handleAllocate} disabled={isProcessing}>
              {isProcessing ? "Allocating..." : "Allocate Shares"}
            </Button>
          )}
          {round.status !== "draft" && (
            <Button variant="outline" onClick={handleReopenRound}>
              Reopen
            </Button>
          )}
        </div>
      </div>

      {/* Round Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Crowd Ownership at Close</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatPercent(round.crowdPercentAtClose)}
            </p>
          </CardContent>
        </Card>
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
            <CardDescription>Investors</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{investments.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* CSV Import (only in draft) */}
      {round.status === "draft" && (
        <Card>
          <CardHeader>
            <CardTitle>Import Investors</CardTitle>
            <CardDescription>
              Upload a CSV with columns: Name, Email, Amount (GBP)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="csv">CSV File</Label>
              <Input
                id="csv"
                type="file"
                accept=".csv"
                onChange={handleCsvChange}
              />
            </div>
            {csvPreview.length > 0 && (
              <>
                <div className="border rounded-md overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-4 py-2 text-left">Name</th>
                        <th className="px-4 py-2 text-left">Email</th>
                        <th className="px-4 py-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvPreview.slice(0, 5).map((inv, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-4 py-2">{inv.name}</td>
                          <td className="px-4 py-2">{inv.email}</td>
                          <td className="px-4 py-2 text-right">
                            {formatGbp(inv.amount)}
                          </td>
                        </tr>
                      ))}
                      {csvPreview.length > 5 && (
                        <tr className="border-t">
                          <td colSpan={3} className="px-4 py-2 text-center text-muted-foreground">
                            ... and {csvPreview.length - 5} more
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-sm text-muted-foreground">
                    Total: {formatGbp(csvPreview.reduce((s, i) => s + i.amount, 0))} from{" "}
                    {csvPreview.length} investors
                  </p>
                  <Button onClick={handleImportCsv} disabled={isProcessing}>
                    {isProcessing ? "Importing..." : "Import"}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Investments List */}
      {investments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Investments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-2 text-left">Name</th>
                    <th className="px-4 py-2 text-left">Email</th>
                    <th className="px-4 py-2 text-right">Amount</th>
                    <th className="px-4 py-2 text-right">% of Pool</th>
                  </tr>
                </thead>
                <tbody>
                  {investments.map((inv) => (
                    <tr key={inv.id} className="border-t">
                      <td className="px-4 py-2">{inv.investorName}</td>
                      <td className="px-4 py-2">{inv.investorEmail}</td>
                      <td className="px-4 py-2 text-right">
                        {formatGbp(inv.amountGbp)}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {totalInvested > 0
                          ? formatPercent(inv.amountGbp / totalInvested)
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Allocations (after allocation) */}
      {allocations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Allocations (Locked)</CardTitle>
            <CardDescription>
              Version {round.allocationVersion} &bull; Pro-rata beneficial ownership
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-2 text-left">Name</th>
                    <th className="px-4 py-2 text-left">Email</th>
                    <th className="px-4 py-2 text-right">Invested</th>
                    <th className="px-4 py-2 text-right">Share of Nominee</th>
                    <th className="px-4 py-2 text-right">% of Company</th>
                  </tr>
                </thead>
                <tbody>
                  {allocations.map((alloc) => (
                    <tr key={alloc.id} className="border-t">
                      <td className="px-4 py-2">{alloc.investorName}</td>
                      <td className="px-4 py-2">{alloc.investorEmail}</td>
                      <td className="px-4 py-2 text-right">
                        {formatGbp(alloc.investedAmountGbpSnapshot)}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {formatPercent(alloc.shareOfNominee)}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {formatPercent(alloc.companyPercentAtClose)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: "bg-yellow-100 text-yellow-800",
    closed: "bg-blue-100 text-blue-800",
    allocated: "bg-green-100 text-green-800",
  }
  return (
    <span
      className={`px-3 py-1 rounded-full text-sm font-medium ${styles[status] || "bg-gray-100"}`}
    >
      {status}
    </span>
  )
}
