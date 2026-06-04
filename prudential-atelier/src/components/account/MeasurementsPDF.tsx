import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

export type MeasurementsPdfModel = {
  clientName: string;
  unit: string;
  updatedAt: string;
  fields: { label: string; value: string }[];
  notes?: string | null;
};

const styles = StyleSheet.create({
  page: { backgroundColor: "#F0E8DD", padding: 40, fontFamily: "Helvetica" },
  card: { backgroundColor: "#F7F2EC", border: "1pt solid #D4BBAC", padding: 32 },
  brand: {
    fontSize: 9,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: "#98755B",
    marginBottom: 8,
  },
  title: { fontSize: 22, color: "#442913", marginBottom: 4 },
  meta: { fontSize: 10, color: "#98755B", marginBottom: 24 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  cell: {
    width: "30%",
    border: "1pt solid #D4BBAC",
    padding: 12,
    marginBottom: 8,
    textAlign: "center",
  },
  value: { fontSize: 20, color: "#442913", marginBottom: 4 },
  unit: { fontSize: 8, color: "#98755B" },
  label: { fontSize: 8, color: "#5C3422", marginTop: 4, textTransform: "uppercase" },
  notes: { marginTop: 16, fontSize: 10, color: "#5C3422", lineHeight: 1.5 },
});

export function MeasurementsPdfDocument({ data }: { data: MeasurementsPdfModel }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.card}>
          <Text style={styles.brand}>Prudential Atelier</Text>
          <Text style={styles.title}>Measurement Card</Text>
          <Text style={styles.meta}>
            {data.clientName} · Updated {data.updatedAt} · {data.unit}
          </Text>
          <View style={styles.grid}>
            {data.fields.map((f) => (
              <View key={f.label} style={styles.cell}>
                <Text style={styles.value}>{f.value}</Text>
                <Text style={styles.unit}>{data.unit}</Text>
                <Text style={styles.label}>{f.label}</Text>
              </View>
            ))}
          </View>
          {data.notes ? <Text style={styles.notes}>Notes: {data.notes}</Text> : null}
        </View>
      </Page>
    </Document>
  );
}
