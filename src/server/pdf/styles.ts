import { StyleSheet } from '@react-pdf/renderer'

/**
 * How an invoice is laid out on the page.
 *
 * Kept apart from the document itself so the layout can be adjusted against the
 * side-by-side comparison with the old service's PDFs without touching what goes on
 * the page.
 */

export const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 48,
    paddingHorizontal: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#0f172a',
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 28 },
  logo: { maxWidth: 140, maxHeight: 56, objectFit: 'contain' },
  title: { fontSize: 22, fontFamily: 'Helvetica-Bold', textAlign: 'right' },
  titleMeta: { textAlign: 'right', color: '#475569', marginTop: 4 },

  parties: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  party: { width: '48%' },
  partyLabel: {
    fontSize: 8,
    letterSpacing: 1,
    color: '#64748b',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
  },
  partyLine: { marginBottom: 2 },

  tableHead: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#0f172a',
    paddingBottom: 6,
    marginBottom: 6,
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e2e8f0',
  },
  cellDescription: { width: '46%' },
  cellQuantity: { width: '12%', textAlign: 'right' },
  cellRate: { width: '16%', textAlign: 'right' },
  cellTax: { width: '12%', textAlign: 'right' },
  cellAmount: { width: '14%', textAlign: 'right' },

  totals: { marginTop: 16, alignItems: 'flex-end' },
  totalRow: { flexDirection: 'row', width: 240, justifyContent: 'space-between', paddingVertical: 3 },
  totalLabel: { color: '#475569' },
  grandTotalRow: {
    flexDirection: 'row',
    width: 240,
    justifyContent: 'space-between',
    paddingTop: 7,
    marginTop: 5,
    borderTopWidth: 1,
    borderTopColor: '#0f172a',
    fontFamily: 'Helvetica-Bold',
    fontSize: 12,
  },

  footer: { marginTop: 30, borderTopWidth: 0.5, borderTopColor: '#e2e8f0', paddingTop: 12 },
  footerLabel: { fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  footerText: { color: '#334155', marginBottom: 2 },
  note: { marginTop: 16, color: '#334155' },
})
