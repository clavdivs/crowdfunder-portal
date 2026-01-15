import { Timestamp } from "firebase/firestore"

// Company
export interface Company {
  id: string
  legalName: string
  createdAt: Timestamp
}

// Round status
export type RoundStatus = "draft" | "closed" | "allocated"

// Crowdfund Round
export interface Round {
  id: string
  companyId: string
  roundName: string
  nomineeName: string
  status: RoundStatus
  crowdPercentAtClose: number // e.g., 0.10 for 10%
  closeDate?: Timestamp
  createdAt: Timestamp
  totalInvestedGbp?: number
  allocationVersion: number
}

// Investment source
export type InvestmentSource = "GoFundMe" | "CSV" | "Manual"

// Investment record (subcollection of rounds)
export interface Investment {
  id: string
  investorEmail: string // lowercased
  investorName: string
  amountGbp: number
  source: InvestmentSource
  createdAt: Timestamp
}

// Allocation record (subcollection of rounds)
export interface Allocation {
  id: string
  investorEmail: string
  investorName: string
  investedAmountGbpSnapshot: number
  shareOfNominee: number // 0..1
  companyPercentAtClose: number // crowdPercentAtClose * shareOfNominee
  allocationVersion: number
  createdAt: Timestamp
}

// Financing event input mode
export type FinancingInputMode = "PERCENT" | "INVESTMENT_AND_VALUATION"

// Financing Event (dilution)
export interface FinancingEvent {
  id: string
  companyId: string
  eventDate: Timestamp
  investorName: string // e.g., VC fund name
  inputMode: FinancingInputMode
  percentSold: number // 0..1, always stored after derivation
  investmentAmountGbp?: number
  postMoneyValuationGbp?: number
  createdAt: Timestamp
}

// Investor Profile
export interface InvestorProfile {
  id: string
  email: string // lowercased
  fullName?: string
  createdAt: Timestamp
  lastLoginAt?: Timestamp
}

// Contact Message
export type ContactMessageStatus = "new" | "read"

export interface ContactMessage {
  id: string
  name: string
  email: string
  message: string
  createdAt: Timestamp
  status: ContactMessageStatus
}

// Audit Log
export interface AuditLog {
  id: string
  actor: string // e.g., "admin:email@example.com"
  action: string
  entityType: string
  entityId: string
  payload?: Record<string, unknown>
  createdAt: Timestamp
}

// Computed investor holdings (for display)
export interface InvestorHoldings {
  investorEmail: string
  investorName: string
  investedAmountGbp: number
  shareOfNominee: number // their share of the nominee pool
  companyPercentAtClose: number // their % of company at close
  companyPercentNow: number // their % after dilution
  impliedValueGbp?: number // if valuation available
  roundName: string
  nomineeName: string
}

// Dilution calculation result
export interface DilutionResult {
  crowdPercentAtClose: number
  crowdPercentNow: number
  dilutionMultiplier: number
  latestValuationGbp?: number
  events: FinancingEvent[]
}
