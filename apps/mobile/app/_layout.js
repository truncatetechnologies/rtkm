import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerStyle: { backgroundColor: "#0b7a3b" }, headerTintColor: "#fff" }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="pump/[id]" options={{ title: "Pump details" }} />
    </Stack>
  );
}
