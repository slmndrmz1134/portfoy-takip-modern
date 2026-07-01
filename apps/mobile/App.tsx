import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";

/**
 * Faz 0/1 iskelet ekranı. @portfoy/core (TWR/XIRR/pricing) web ile paylaşılır;
 * Faz 5'te giriş + dashboard + işlem ekranlarıyla doldurulacak.
 */
export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Portföy Takip</Text>
      <Text style={styles.subtitle}>Mobil iskelet hazır — @portfoy/core web ile paylaşılıyor.</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111111",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  title: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 8,
  },
  subtitle: {
    color: "#aaaaaa",
    fontSize: 14,
    textAlign: "center",
  },
});
