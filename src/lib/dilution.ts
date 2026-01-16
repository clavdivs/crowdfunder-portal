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

// =============================================================================
// SHARE-BASED DILUTION CALCULATIONS
// Standard dilution formula used globally for ordinary share issuances
// Same formula used by Y Combinator, Carta, Seedrs, and Companies House
// =============================================================================

/**
 * Calculate new total shares after issuing X% to a new/existing shareholder
 *
 * Formula: New Total = Existing Total / (1 - X)
 *
 * @param existingTotalShares - Current total shares outstanding
 * @param dilutionPercent - Percentage to issue (e.g., 5 for 5%, NOT 0.05)
 * @returns New total shares after issuance
 *
 * @example
 * calculateNewTotalShares(100000, 5) // => 105263.16 (issuing 5%)
 */
export function calculateNewTotalShares(
  existingTotalShares: number,
  dilutionPercent: number
): number {
  if (dilutionPercent <= 0 || dilutionPercent >= 100) {
    throw new Error("Dilution percent must be between 0 and 100 (exclusive)")
  }
  return existingTotalShares / (1 - dilutionPercent / 100)
}

/**
 * Calculate number of new shares to issue for a given dilution percentage
 *
 * Formula: New Shares = (Existing Total × X) / (1 - X)
 *
 * This ensures the recipient ends up with exactly X% of the post-money cap table
 *
 * @param existingTotalShares - Current total shares outstanding
 * @param dilutionPercent - Percentage to issue (e.g., 5 for 5%, NOT 0.05)
 * @returns Number of new shares to issue
 *
 * @example
 * calculateSharesToIssue(100000, 5) // => 5263.16 shares (to give exactly 5%)
 */
export function calculateSharesToIssue(
  existingTotalShares: number,
  dilutionPercent: number
): number {
  const newTotal = calculateNewTotalShares(existingTotalShares, dilutionPercent)
  return newTotal - existingTotalShares
}

/**
 * Calculate percentage ownership from shares
 *
 * @param shares - Number of shares held
 * @param totalShares - Total shares outstanding
 * @returns Percentage as decimal (e.g., 0.05 for 5%)
 */
export function calculateOwnershipPercent(
  shares: number,
  totalShares: number
): number {
  if (totalShares === 0) return 0
  return shares / totalShares
}

/**
 * Calculate percentage ownership from shares (as display value)
 *
 * @param shares - Number of shares held
 * @param totalShares - Total shares outstanding
 * @returns Percentage as number (e.g., 5 for 5%)
 */
export function calculateOwnershipPercentDisplay(
  shares: number,
  totalShares: number
): number {
  return calculateOwnershipPercent(shares, totalShares) * 100
}

/**
 * Calculate how many shares needed to reach a target ownership percentage
 *
 * @param targetPercent - Target percentage (e.g., 10 for 10%)
 * @param totalSharesAfterIssuance - Total shares after the new shares are issued
 * @returns Number of shares needed
 */
export function calculateSharesForTargetOwnership(
  targetPercent: number,
  totalSharesAfterIssuance: number
): number {
  return (targetPercent / 100) * totalSharesAfterIssuance
}

/**
 * Calculate diluted ownership after a new share issuance
 *
 * @param currentShares - Shares currently held
 * @param currentTotalShares - Current total shares outstanding
 * @param newSharesIssued - New shares being issued to others
 * @returns New ownership percentage as decimal (e.g., 0.08 for 8%)
 */
export function calculateDilutedOwnership(
  currentShares: number,
  currentTotalShares: number,
  newSharesIssued: number
): number {
  const newTotalShares = currentTotalShares + newSharesIssued
  return currentShares / newTotalShares
}

/**
 * Full share-based dilution scenario calculation
 *
 * @param existingShares - Map of shareholder to their current shares
 * @param dilutionPercent - Percentage being issued to new holder (e.g., 20 for 20%)
 * @param newHolderName - Name of the new shareholder
 * @returns Complete cap table after dilution
 */
export function calculateShareDilutionScenario(
  existingShares: Map<string, number>,
  dilutionPercent: number,
  newHolderName: string
): {
  previousTotal: number
  newTotal: number
  newSharesIssued: number
  capTable: Array<{
    holder: string
    shares: number
    percentBefore: number
    percentAfter: number
    dilution: number
  }>
} {
  const previousTotal = Array.from(existingShares.values()).reduce((a, b) => a + b, 0)
  const newSharesIssued = calculateSharesToIssue(previousTotal, dilutionPercent)
  const newTotal = previousTotal + newSharesIssued

  const capTable: Array<{
    holder: string
    shares: number
    percentBefore: number
    percentAfter: number
    dilution: number
  }> = []

  // Existing shareholders (diluted)
  for (const [holder, shares] of existingShares) {
    const percentBefore = shares / previousTotal
    const percentAfter = shares / newTotal
    capTable.push({
      holder,
      shares,
      percentBefore,
      percentAfter,
      dilution: percentBefore - percentAfter,
    })
  }

  // New shareholder
  capTable.push({
    holder: newHolderName,
    shares: newSharesIssued,
    percentBefore: 0,
    percentAfter: newSharesIssued / newTotal, // Should equal dilutionPercent / 100
    dilution: 0,
  })

  return {
    previousTotal,
    newTotal,
    newSharesIssued,
    capTable,
  }
}

// =============================================================================
// FORMATTING UTILITIES
// =============================================================================

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
