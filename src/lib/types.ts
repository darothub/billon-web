// Envelope
export interface ApiResponse<T> {
  status: 'success' | 'error'
  message: string
  data: T | null
}

// Pagination
export interface PageResponse<T> {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  first: boolean
  last: boolean
}

// Auth
export interface AuthResponse {
  token: string
  user: UserProfile
}

export interface UserProfile {
  id: number
  email: string
  firstName: string
  lastName: string
  defaultCurrency: string
  invoicePrefix: string
  taxLabel: string
  logoUrl: string | null
}

// Clients
export interface ClientSummary {
  id: number
  name: string
  email: string
  companyName: string | null
  invoiceCount: number
  createdAt: string
}

export interface ClientDetail extends ClientSummary {
  addressLine1: string | null
  addressLine2: string | null
  city: string | null
  postcode: string | null
  country: string | null
  updatedAt: string
}

// Invoices
export type InvoiceStatus = 'DRAFT' | 'SENT' | 'OVERDUE' | 'PAID' | 'VOID'

export interface InvoiceSummary {
  id: number
  invoiceNumber: string
  clientName: string
  status: InvoiceStatus
  issueDate: string
  dueDate: string
  currency: string
  total: number
  createdAt: string
}

export interface InvoiceLineItemResponse {
  id: number
  description: string
  quantity: number
  unitRate: number
  taxRate: number | null
  lineTotal: number
  taxAmount: number
  position: number
}

export interface InvoiceDetail {
  id: number
  invoiceNumber: string
  client: ClientDetail
  status: InvoiceStatus
  issueDate: string
  dueDate: string
  currency: string
  taxLabel: string
  note: string | null
  lineItems: InvoiceLineItemResponse[]
  subtotal: number
  taxTotal: number
  total: number
  sentAt: string | null
  paidAt: string | null
  voidedAt: string | null
  createdAt: string
  updatedAt: string
}

// Dashboard
export interface CurrencyTotal {
  currency: string
  amount: number
}

export interface DashboardSummary {
  draft: { count: number }
  outstanding: { count: number; totals: CurrencyTotal[] }
  overdue: { count: number; totals: CurrencyTotal[] }
  paidThisMonth: { count: number; totals: CurrencyTotal[] }
}

// Form request types
export interface CreateClientRequest {
  name: string
  email: string
  companyName?: string
  addressLine1?: string
  addressLine2?: string
  city?: string
  postcode?: string
  country?: string
}

export interface UpdateClientRequest extends CreateClientRequest {}

export interface AddLineItemRequest {
  description: string
  quantity: number
  unitRate: number
  taxRate?: number
}

export interface CreateInvoiceRequest {
  clientId: number
  currency: string
  issueDate: string
  dueDate: string
  taxLabel?: string
  note?: string
  lineItems: AddLineItemRequest[]
}

export interface UpdateInvoiceRequest {
  issueDate?: string
  dueDate?: string
  taxLabel?: string
  note?: string
}

export interface UpdateProfileRequest {
  firstName: string
  lastName: string
  invoicePrefix: string
  taxLabel: string
  defaultCurrency: string
}

// Local line item draft (form state only, never sent as-is to API)
export interface LineItemDraft {
  localId: string
  description: string
  quantity: string
  unitRate: string
  taxRate: string
}
