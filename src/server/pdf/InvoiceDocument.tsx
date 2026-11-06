import { Document, Image, Page, Text, View } from '@react-pdf/renderer'
import type { InvoiceDetail, UserProfile } from '@/lib/types'
import { styles } from './styles'

/**
 * One invoice, laid out on a page: the logo, who it is from and who it is for, the
 * lines, the tax, the totals and how to pay.
 */

export interface InvoiceDocumentProps {
  invoice: InvoiceDetail
  profile: UserProfile
  logo: { data: Buffer; format: 'png' | 'jpg' } | null
}

export function InvoiceDocument({ invoice, profile, logo }: InvoiceDocumentProps) {
  const money = (amount: number) => `${invoice.currency} ${amount.toFixed(2)}`

  return (
    <Document title={invoice.invoiceNumber} author={`${profile.firstName} ${profile.lastName}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            {logo ? <Image style={styles.logo} src={logo as unknown as string} /> : null}
            <Text style={{ marginTop: logo ? 8 : 0, fontFamily: 'Helvetica-Bold', fontSize: 13 }}>
              {profile.firstName} {profile.lastName}
            </Text>
          </View>
          <View>
            <Text style={styles.title}>INVOICE</Text>
            <Text style={styles.titleMeta}>{invoice.invoiceNumber}</Text>
            <Text style={styles.titleMeta}>Issued {invoice.issueDate}</Text>
            <Text style={styles.titleMeta}>Due {invoice.dueDate}</Text>
          </View>
        </View>

        <View style={styles.parties}>
          <View style={styles.party}>
            <Text style={styles.partyLabel}>FROM</Text>
            <Text style={styles.partyLine}>
              {profile.firstName} {profile.lastName}
            </Text>
            <Text style={styles.partyLine}>{profile.email}</Text>
          </View>
          <View style={styles.party}>
            <Text style={styles.partyLabel}>BILL TO</Text>
            <Text style={styles.partyLine}>{invoice.client.companyName ?? invoice.client.name}</Text>
            {invoice.client.companyName ? (
              <Text style={styles.partyLine}>{invoice.client.name}</Text>
            ) : null}
            <Text style={styles.partyLine}>{invoice.client.email}</Text>
            {addressLines(invoice).map((line, index) => (
              <Text key={index} style={styles.partyLine}>
                {line}
              </Text>
            ))}
          </View>
        </View>

        <View style={styles.tableHead}>
          <Text style={styles.cellDescription}>Description</Text>
          <Text style={styles.cellQuantity}>Qty</Text>
          <Text style={styles.cellRate}>Rate</Text>
          <Text style={styles.cellTax}>{invoice.taxLabel}</Text>
          <Text style={styles.cellAmount}>Amount</Text>
        </View>

        {invoice.lineItems.map((line) => (
          <View key={line.id} style={styles.row}>
            <Text style={styles.cellDescription}>{line.description}</Text>
            <Text style={styles.cellQuantity}>{line.quantity}</Text>
            <Text style={styles.cellRate}>{line.unitRate.toFixed(2)}</Text>
            <Text style={styles.cellTax}>
              {line.taxRate ? `${(line.taxRate * 100).toFixed(2)}%` : '—'}
            </Text>
            <Text style={styles.cellAmount}>{line.lineTotal.toFixed(2)}</Text>
          </View>
        ))}

        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text>{money(invoice.subtotal)}</Text>
          </View>
          {(invoice.taxEntries ?? []).map((entry, index) => (
            <View key={index} style={styles.totalRow}>
              <Text style={styles.totalLabel}>
                {entry.label} {(entry.rate * 100).toFixed(2)}%
              </Text>
              <Text>{money(invoice.subtotal * entry.rate)}</Text>
            </View>
          ))}
          {(invoice.taxEntries ?? []).length === 0 && invoice.taxTotal > 0 ? (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>{invoice.taxLabel}</Text>
              <Text>{money(invoice.taxTotal)}</Text>
            </View>
          ) : null}
          <View style={styles.grandTotalRow}>
            <Text>Total</Text>
            <Text>{money(invoice.total)}</Text>
          </View>
        </View>

        {invoice.note ? <Text style={styles.note}>{invoice.note}</Text> : null}

        <View style={styles.footer}>
          <Text style={styles.footerLabel}>Payment details</Text>
          {profile.bankName ? (
            <Text style={styles.footerText}>Bank: {profile.bankName}</Text>
          ) : null}
          {profile.bankAccountNumber ? (
            <Text style={styles.footerText}>Account: {profile.bankAccountNumber}</Text>
          ) : null}
          {profile.bankSortCode ? (
            <Text style={styles.footerText}>Sort code: {profile.bankSortCode}</Text>
          ) : null}
          {profile.paymentDetails
            ? profile.paymentDetails.split('\n').map((line, index) => (
                <Text key={index} style={styles.footerText}>
                  {line}
                </Text>
              ))
            : null}
        </View>
      </Page>
    </Document>
  )
}

function addressLines(invoice: InvoiceDetail): string[] {
  const client = invoice.client
  return [client.addressLine1, client.addressLine2, client.city, client.postcode, client.country]
    .filter((line): line is string => Boolean(line && line.trim()))
}
