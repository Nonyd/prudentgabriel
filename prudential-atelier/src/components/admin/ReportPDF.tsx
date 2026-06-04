import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

export type ReportPdfModel = {
  title: string;
  kpis: { label: string; value: string; change: string }[];
  topClients: { name: string; spend: string; tier: string }[];
};

const styles = StyleSheet.create({
  page: { backgroundColor: "#F0E8DD", padding: 36, fontFamily: "Helvetica", fontSize: 10, color: "#442913" },
  brand: { fontSize: 9, letterSpacing: 2, color: "#98755B", marginBottom: 12, textTransform: "uppercase" },
  title: { fontSize: 20, marginBottom: 20 },
  section: { marginBottom: 16, paddingBottom: 12, borderBottom: "1pt solid #D4BBAC" },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  label: { color: "#5C3422" },
  value: { fontWeight: "bold" },
});

export function ReportPdfDocument({ data }: { data: ReportPdfModel }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.brand}>Prudential Atelier</Text>
        <Text style={styles.title}>{data.title}</Text>
        <View style={styles.section}>
          <Text style={{ marginBottom: 8, fontSize: 12 }}>KPI Overview</Text>
          {data.kpis.map((k) => (
            <View key={k.label} style={styles.row}>
              <Text style={styles.label}>{k.label}</Text>
              <Text style={styles.value}>
                {k.value} ({k.change})
              </Text>
            </View>
          ))}
        </View>
        <View style={styles.section}>
          <Text style={{ marginBottom: 8, fontSize: 12 }}>Top Clients</Text>
          {data.topClients.map((c) => (
            <View key={c.name} style={styles.row}>
              <Text style={styles.label}>{c.name}</Text>
              <Text style={styles.value}>
                {c.spend} · {c.tier}
              </Text>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
}
