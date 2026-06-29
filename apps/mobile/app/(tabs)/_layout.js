import { Tabs } from "expo-router";
import { StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { C } from "../../lib/theme";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.green,
        tabBarInactiveTintColor: C.faint,
        tabBarStyle: {
          position: "absolute",
          left: 0, right: 0, bottom: 0,
          height: 80,
          paddingTop: 8,
          paddingBottom: 20,
          borderTopWidth: 0,
          backgroundColor: "transparent",
          elevation: 0,
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
        tabBarBackground: () => (
          <BlurView intensity={45} tint="light" style={[StyleSheet.absoluteFill, styles.tabBg]} />
        ),
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Calculator", tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="calculator-variant" size={size} color={color} /> }} />
      <Tabs.Screen name="fleet" options={{ title: "My Fleet", tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="truck" size={size} color={color} /> }} />
      <Tabs.Screen name="settings" options={{ title: "Settings", tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="cog" size={size} color={color} /> }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBg: {
    backgroundColor: "rgba(255,255,255,0.45)",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.6)",
  },
});
