import type { FinancingEvent, DilutionResult, Allocation } from "@/types"

/**
 * Calculate percentSold from investment amount and post-money valuation
 * Used for Method B input
 */
export function derivePercentSold(
  investmentAmountGbp: number,
  postMoneyValuationGbp: number
): number {
  if (postMoneyValuationGbp <= 0) {
    throw new Error("Post-money valuation must be greater than 0")
  }
  const percentSold = investmentAmountGbp / postMoneyValuationGbp
  if (percentSold <= 0 || percentSold >= 1) {
    throw new Error("Derived percentSold must be between 0 and 1 (exclusive)")
  }
  return percentSold
}

/**
 * Validate percentSold is within valid range
 */
export function validatePercentSold(percentSold: number): void {
  if (percentSold <= 0 || percentSold >= 1) {
    throw new Error("percentSold must be between 0 and 1 (exclusive)")
  }
}

/**
 * Calculate dilution multiplier from a list of financing events
 * dilutionMultiplier = Π (1 - percentSold_event)
 */
export function calculateDilutionMultiplier(events: FinancingEvent[]): number {
  return events.reduce((multiplier, event) => {
    return multiplier * (1 - event.percentSold)
  }, 1)
}

/**
 * Calculate current crowd ownership after dilution
 */
export function calculateCrowdPercentNow(
  crowdPercentAtClose: number,
  events: FinancingEvent[]
): number {
  const dilutionMultiplier = calculateDilutionMultiplier(events)
  return crowdPercentAtClose * dilutionMultiplier
}

/**
 * Calculate investor's current ownership percentage
 */
export function calculateInvestorPercentNow(
  crowdPercentNow: number,
  shareOfNominee: number
): number {
  return crowdPercentNow * shareOfNominee
}

/**
 * Calculate investor's implied value based on latest valuation
 */
export function calculateImpliedValue(
  investorPercentNow: number,
  postMoneyValuationGbp: number
): number {
  return investorPercentNow * postMoneyValuationGbp
}

/**
 * Get the latest valuation from financing events (if any)
 */
export function getLatestValuation(
  events: FinancingEvent[]
): number | undefined {
  // Events should be sorted by date, get the last one with a valuation
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].postMoneyValuationGbp) {
      return events[i].postMoneyValuationGbp
    }
  }
  return undefined
}

/**
 * Full dilution calculation for a given crowd pool
 */
export function calculateDilution(
  crowdPercentAtClose: number,
  events: FinancingEvent[]
): DilutionResult {
  // Sort events by date
  const sortedEvents = [...events].sort((a, b) => {
    const dateA = a.eventDate.toDate().getTime()
    const dateB = b.eventDate.toDate().getTime()
    return dateA - dateB
  })

  const dilutionMultiplier = calculateDilutionMultiplier(sortedEvents)
  const crowdPercentNow = crowdPercentAtClose * dilutionMultiplier
  const latestValuationGbp = getLatestValuation(sortedEvents)

  return {
    crowdPercentAtClose,
    crowdPercentNow,
    dilutionMultiplier,
    latestValuationGbp,
    events: sortedEvents,
  }
}

/**
 * Calculate pro-rata allocations for investors
 * investorShareOfNominee = investedAmount / totalInvested
 * investorCompanyPercentAtClose = crowdPercentAtClose * investorShareOfNominee
 */
export function calculateAllocations(
  investments: Array<{ investorEmail: string; investorName: string; amountGbp: number }>,
  crowdPercentAtClose: number
): Array<{
  investorEmail: string
  investorName: string
  investedAmountGbp: number
  shareOfNominee: number
  companyPercentAtClose: number
}> {
  const totalInvested = investments.reduce((sum, inv) => sum + inv.amountGbp, 0)

  if (totalInvested <= 0) {
    throw new Error("Total invested amount must be greater than 0")
  }

  return investments.map((inv) => {
    const shareOfNominee = inv.amountGbp / totalInvested
    const companyPercentAtClose = crowdPercentAtClose * shareOfNominee

    return {
      investorEmail: inv.investorEmail.toLowerCase(),
      investorName: inv.investorName,
      investedAmountGbp: inv.amountGbp,
      shareOfNominee,
      companyPercentAtClose,
    }
  })
}

/**
 * Format percentage for display (e.g., 0.1 -> "10.00%")
 */
export function formatPercent(value: number, decimals: number = 2): string {
  return `${(value * 100).toFixed(decimals)}%`
}

/**
 * Format currency for display (GBP)
 */
export function formatGbp(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(value)
}
