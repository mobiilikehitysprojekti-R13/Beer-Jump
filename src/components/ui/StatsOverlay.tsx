import { View, Text, StyleSheet, TouchableOpacity } from "react-native"

type Props = {
  visible: boolean
  onClose: () => void
}

// ───────────────────────────────
// DATA
// ───────────────────────────────

const months = ["Feb", "Mar", "Apr", "May", "Jun", "Jul"]

const playerData = [2000, 5000, 8000, 13000, 9000, 3000]

const yAxisPlayers = [0, 2000, 4000, 6000, 8000, 10000, 12000, 14000]

const scoreDistribution = [
  { score: 0, count: 2 },
  { score: 200, count: 5 },
  { score: 400, count: 12 },
  { score: 600, count: 20 },
  { score: 800, count: 25 },
  { score: 1000, count: 18 },
  { score: 1200, count: 6 },
]

export function StatsOverlay({ visible, onClose }: Props) {
  if (!visible) return null

  const maxPlayers = 14000
  const maxScoreCount = 25

  return (
    <View style={styles.overlay}>
      <View style={styles.container}>

        <Text style={styles.title}>📊 Stats</Text>

        {/* ─────────────────────────────── */}
        {/* PLAYERS PER MONTH */}
        {/* ─────────────────────────────── */}

        <Text style={styles.subtitle}>Players per Month</Text>

        <View style={styles.graphRow}>
          <View style={styles.yAxis}>
            {yAxisPlayers.slice().reverse().map((v) => (
              <Text key={v} style={styles.axisText}>{v}</Text>
            ))}
          </View>

          <View style={styles.graphArea}>
            {playerData.map((value, i) => (
              <View key={i} style={styles.barContainer}>
                <View
                  style={[
                    styles.bar,
                    { height: (value / maxPlayers) * 120 },
                  ]}
                />
              </View>
            ))}
          </View>
        </View>

        <View style={styles.xAxis}>
          {months.map((m) => (
            <Text key={m} style={styles.axisText}>{m}</Text>
          ))}
        </View>

        {/* ─────────────────────────────── */}
        {/* SCORE DISTRIBUTION */}
        {/* ─────────────────────────────── */}

        <Text style={[styles.subtitle, { marginTop: 20 }]}>
          Score Distribution
        </Text>

        <View style={styles.graphRow}>
          <View style={styles.yAxis}>
            {[25, 20, 15, 10, 5, 0].map((v) => (
              <Text key={v} style={styles.axisText}>{v}</Text>
            ))}
          </View>

          <View style={styles.graphArea}>
            {scoreDistribution.map((item, i) => (
              <View key={i} style={styles.barContainer}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: (item.count / maxScoreCount) * 120,
                      backgroundColor: "#00C853",
                    },
                  ]}
                />
              </View>
            ))}
          </View>
        </View>

        <View style={styles.xAxis}>
          {scoreDistribution.map((item) => (
            <Text key={item.score} style={styles.axisText}>
              {item.score}
            </Text>
          ))}
        </View>

        {/* CLOSE */}
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeText}>Close</Text>
        </TouchableOpacity>

      </View>
    </View>
  )
}

// ───────────────────────────────
// STYLES
// ───────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
  },

  container: {
    width: "92%",
    backgroundColor: "#1e1e2f",
    borderRadius: 16,
    padding: 16,
  },

  title: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#FFA000",
    textAlign: "center",
    marginBottom: 10,
  },

  subtitle: {
    color: "#fff",
    fontSize: 14,
    opacity: 0.8,
    marginBottom: 6,
  },

  // ─────────────────────────
  // GRAPH LAYOUT
  // ─────────────────────────

  graphRow: {
    flexDirection: "row",
    height: 140,
  },

  yAxis: {
    justifyContent: "space-between",
    marginRight: 6,
  },

  xAxis: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },

  axisText: {
    color: "#aaa",
    fontSize: 10,
  },

  graphArea: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderColor: "#444",
  },

  barContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
  },

  bar: {
    width: 10,
    backgroundColor: "#FFA000",
    borderRadius: 4,
  },

  // ─────────────────────────
  // CLOSE BUTTON
  // ─────────────────────────

  closeButton: {
    marginTop: 16,
    backgroundColor: "#444",
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
  },

  closeText: {
    color: "#fff",
    fontWeight: "bold",
  },
})