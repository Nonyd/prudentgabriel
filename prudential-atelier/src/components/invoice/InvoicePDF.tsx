import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { InvoiceStatus } from "@prisma/client";
import type { InvoiceBankDetails, InvoiceBusinessDetails, InvoiceCurrency, InvoiceLineItem } from "@/types/invoice";
import { formatInvoiceCurrency } from "@/lib/invoice";

const styles = StyleSheet.create({
  page: { padding: 48, fontFamily: "Helvetica", fontSize: 10, color: "#0A0A0A" },
  headerRow: { flexDirection: "row", justifyContent: "space-between" },
  logo: { width: 120 },
  bizName: { marginTop: 8, fontSize: 16, fontFamily: "Helvetica-Bold" },
  tagline: { marginTop: 2, fontSize: 9, color: "#8A8A85" },
  invTitle: { fontSize: 28, fontFamily: "Helvetica-Bold", letterSpacing: 4 },
  invNum: { marginTop: 4, fontSize: 11, color: "#37392d" },
  badge: { marginTop: 6, paddingHorizontal: 8, paddingVertical: 4, fontSize: 8, alignSelf: "flex-end" },
  divider: { height: 1, backgroundColor: "#E8E8E4", marginVertical: 16 },
  dateRow: { flexDirection: "row", justifyContent: "space-between" },
  labelSm: { fontSize: 8, color: "#A8A8A4", textTransform: "uppercase", letterSpacing: 1 },
  valSm: { marginTop: 2, fontSize: 10 },
  billingRow: { flexDirection: "row", marginTop: 20, gap: 40 },
  col: { flex: 1 },
  blockTitle: { fontSize: 7, color: "#A8A8A4", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 },
  lineBold: { fontSize: 11, fontFamily: "Helvetica-Bold" },
  lineMuted: { fontSize: 9, color: "#6B6B68", marginTop: 2 },
  tableHead: { flexDirection: "row", backgroundColor: "#37392d", paddingVertical: 8, paddingHorizontal: 12, marginTop: 24 },
  th: { fontSize: 8, color: "#ffffff", textTransform: "uppercase" },
  row: { flexDirection: "row", paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 0.5, borderBottomColor: "#F0F0EE" },
  rowAlt: { backgroundColor: "#FAFAF8" },
  totals: { marginTop: 12, alignItems: "flex-end" },
  totalLine: { flexDirection: "row", justifyContent: "flex-end", gap: 24, marginBottom: 4 },
  totalBig: { fontSize: 12, fontFamily: "Helvetica-Bold" },
  termsBox: { marginTop: 20, padding: 12, backgroundColor: "#FAFAF8" },
  termsText: { marginTop: 4, fontSize: 9, color: "#6B6B68" },
  bankBlock: { marginTop: 12 },
  footer: { position: "absolute", bottom: 36, left: 48, right: 48, borderTopWidth: 0.5, borderTopColor: "#E8E8E4", paddingTop: 8, flexDirection: "row", justifyContent: "space-between" },
  footerNote: { fontSize: 8, color: "#A8A8A4", flex: 1, paddingRight: 12 },
  footerCenter: { fontSize: 8, color: "#37392d" },
  footerPage: { fontSize: 8, color: "#A8A8A4" },
});

function statusBadgeStyle(status: InvoiceStatus): { bg: string; fg: string } {
  switch (status) {
    case "DRAFT":
      return { bg: "#F2F2F0", fg: "#6B6B68" };
    case "SENT":
    case "VIEWED":
      return { bg: "#E8F4FF", fg: "#1A5FAD" };
    case "PAID":
      return { bg: "#E8F5E9", fg: "#1B5E20" };
    case "OVERDUE":
      return { bg: "#FDECEA", fg: "#8B1A1A" };
    case "PARTIALLY_PAID":
      return { bg: "#FFF8E7", fg: "#8D6E00" };
    default:
      return { bg: "#F2F2F0", fg: "#6B6B68" };
  }
}

export type InvoicePdfModel = {
  invoiceNumber: string;
  status: InvoiceStatus;
  currency: InvoiceCurrency;
  createdAt: Date;
  dueDate: Date | null;
  clientName: string;
  clientEmail: string;
  clientPhone: string | null;
  clientAddress: string | null;
  clientCity: string | null;
  clientCountry: string;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  discountType: string | null;
  discountValue: number;
  discountAmount: number;
  vatEnabled: boolean;
  vatPercent: number;
  vatAmount: number;
  total: number;
  depositRequired: number;
  depositPaid: number;
  balanceDue: number;
  paymentTerms: string | null;
  clientNote: string | null;
  showVat: boolean;
  showRcNumber: boolean;
  business: InvoiceBusinessDetails;
  bank: InvoiceBankDetails;
};

export function InvoicePdfDocument({ data }: { data: InvoicePdfModel }) {
  const cur = data.currency;
  const badge = statusBadgeStyle(data.status);
  const overdue =
    data.dueDate != null && data.status !== "PAID" && data.status !== "CANCELLED" && new Date(data.dueDate) < new Date();

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            {data.business.logoUrl ? (
              <Image src={data.business.logoUrl} alt="" style={styles.logo} />
            ) : (
              <View style={{ height: 40 }} />
            )}
            <Text style={styles.bizName}>{data.business.businessName}</Text>
            <Text style={styles.tagline}>{data.business.tagline}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.invTitle}>INVOICE</Text>
            <Text style={styles.invNum}>{data.invoiceNumber}</Text>
            <View style={[styles.badge, { backgroundColor: badge.bg }]}>
              <Text style={{ color: badge.fg }}>{data.status.replace(/_/g, " ")}</Text>
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.dateRow}>
          <View>
            <Text style={styles.labelSm}>Date issued</Text>
            <Text style={styles.valSm}>{data.createdAt.toLocaleDateString("en-GB")}</Text>
          </View>
          <View>
            <Text style={styles.labelSm}>Due date</Text>
            <Text style={[styles.valSm, overdue ? { fontFamily: "Helvetica-Bold" } : {}]}>
              {data.dueDate ? data.dueDate.toLocaleDateString("en-GB") : "—"}
            </Text>
          </View>
          <View>
            <Text style={styles.labelSm}>Invoice #</Text>
            <Text style={[styles.valSm, { color: "#37392d" }]}>{data.invoiceNumber}</Text>
          </View>
        </View>

        <View style={styles.billingRow}>
          <View style={styles.col}>
            <Text style={styles.blockTitle}>From</Text>
            <Text style={styles.lineBold}>{data.business.businessName}</Text>
            <Text style={styles.lineMuted}>{data.business.addressLine1}</Text>
            <Text style={styles.lineMuted}>{data.business.addressLine2}</Text>
            <Text style={styles.lineMuted}>{data.business.city}</Text>
            <Text style={styles.lineMuted}>{data.business.phone}</Text>
            <Text style={[styles.lineMuted, { color: "#37392d" }]}>{data.business.email}</Text>
            <Text style={styles.lineMuted}>{data.business.website}</Text>
            {data.showRcNumber && data.business.rcNumber ? (
              <Text style={styles.lineMuted}>RC: {data.business.rcNumber}</Text>
            ) : null}
          </View>
          <View style={styles.col}>
            <Text style={styles.blockTitle}>Bill to</Text>
            <Text style={styles.lineBold}>{data.clientName}</Text>
            <Text style={styles.lineMuted}>{data.clientEmail}</Text>
            {data.clientPhone ? <Text style={styles.lineMuted}>{data.clientPhone}</Text> : null}
            {data.clientAddress ? <Text style={styles.lineMuted}>{data.clientAddress}</Text> : null}
            <Text style={styles.lineMuted}>
              {[data.clientCity, data.clientCountry].filter(Boolean).join(", ")}
            </Text>
          </View>
        </View>

        <View style={styles.tableHead}>
          <Text style={[styles.th, { flex: 1 }]}>Description</Text>
          <Text style={[styles.th, { width: 40, textAlign: "center" }]}>Qty</Text>
          <Text style={[styles.th, { width: 80, textAlign: "right" }]}>Unit</Text>
          <Text style={[styles.th, { width: 80, textAlign: "right" }]}>Amount</Text>
        </View>
        {data.lineItems.map((li, i) => (
          <View key={li.id} style={[styles.row, i % 2 === 1 ? styles.rowAlt : {}]} wrap={false}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={{ fontSize: 10 }}>{li.description}</Text>
              {li.details ? (
                <Text style={{ fontSize: 9, color: "#8A8A85", marginTop: 2, fontStyle: "italic" }}>{li.details}</Text>
              ) : null}
            </View>
            <Text style={{ width: 40, textAlign: "center", fontSize: 10 }}>{String(li.quantity)}</Text>
            <Text style={{ width: 80, textAlign: "right", fontSize: 10 }}>{formatInvoiceCurrency(li.unitPrice, cur)}</Text>
            <Text style={{ width: 80, textAlign: "right", fontSize: 10, fontFamily: "Helvetica-Bold" }}>
              {formatInvoiceCurrency(li.amount, cur)}
            </Text>
          </View>
        ))}

        <View style={styles.totals}>
          <View style={styles.totalLine}>
            <Text>Subtotal</Text>
            <Text>{formatInvoiceCurrency(data.subtotal, cur)}</Text>
          </View>
          {data.discountAmount > 0 ? (
            <View style={styles.totalLine}>
              <Text style={{ color: "#37392d" }}>
                Discount
                {data.discountType === "PERCENTAGE" ? ` (${data.discountValue}%)` : ""}
              </Text>
              <Text style={{ color: "#37392d" }}>-{formatInvoiceCurrency(data.discountAmount, cur)}</Text>
            </View>
          ) : null}
          {data.showVat && data.vatEnabled && data.vatAmount > 0 ? (
            <View style={styles.totalLine}>
              <Text>VAT ({data.vatPercent}%)</Text>
              <Text>{formatInvoiceCurrency(data.vatAmount, cur)}</Text>
            </View>
          ) : null}
          <View style={[styles.divider, { width: 200, marginVertical: 8 }]} />
          <View style={styles.totalLine}>
            <Text style={styles.totalBig}>Total</Text>
            <Text style={styles.totalBig}>{formatInvoiceCurrency(data.total, cur)}</Text>
          </View>
          {data.depositRequired > 0 ? (
            <>
              <View style={[styles.divider, { width: 200, marginTop: 8, marginBottom: 4 }]} />
              <View style={styles.totalLine}>
                <Text style={{ color: "#37392d" }}>Deposit required</Text>
                <Text>{formatInvoiceCurrency(data.depositRequired, cur)}</Text>
              </View>
              <View style={styles.totalLine}>
                <Text>Deposit paid</Text>
                <Text style={{ color: data.depositPaid > 0 ? "#1B5E20" : "#0A0A0A" }}>
                  {formatInvoiceCurrency(data.depositPaid, cur)}
                </Text>
              </View>
              <View style={styles.totalLine}>
                <Text style={{ fontSize: 11, fontFamily: "Helvetica-Bold", color: data.balanceDue > 0 ? "#8B1A1A" : "#1B5E20" }}>
                  Balance due
                </Text>
                <Text style={{ fontSize: 11, fontFamily: "Helvetica-Bold", color: data.balanceDue > 0 ? "#8B1A1A" : "#1B5E20" }}>
                  {formatInvoiceCurrency(data.balanceDue, cur)}
                </Text>
              </View>
            </>
          ) : null}
        </View>

        {data.paymentTerms ? (
          <View style={styles.termsBox}>
            <Text style={styles.blockTitle}>Payment terms</Text>
            <Text style={styles.termsText}>{data.paymentTerms}</Text>
          </View>
        ) : null}

        <View style={styles.bankBlock}>
          <Text style={styles.blockTitle}>Payment details ({data.bank.currency})</Text>
          <Text style={styles.lineMuted}>Bank: {data.bank.bankName}</Text>
          <Text style={styles.lineMuted}>Account name: {data.bank.accountName}</Text>
          <Text style={[styles.lineMuted, { fontFamily: "Helvetica-Bold" }]}>Account: {data.bank.accountNumber}</Text>
          {data.bank.sortCode ? <Text style={styles.lineMuted}>Sort / routing: {data.bank.sortCode}</Text> : null}
        </View>

        {data.clientNote ? (
          <View style={{ marginTop: 16 }}>
            <Text style={styles.blockTitle}>Note</Text>
            <Text style={{ fontSize: 9, color: "#6B6B68", fontStyle: "italic" }}>{data.clientNote}</Text>
          </View>
        ) : null}

        <View style={styles.footer} fixed>
          <Text style={styles.footerNote}>{data.business.footerNote}</Text>
          <Text style={styles.footerCenter}>{data.business.website}</Text>
          <Text style={styles.footerPage}>Page 1 of 1</Text>
        </View>
      </Page>
    </Document>
  );
}
