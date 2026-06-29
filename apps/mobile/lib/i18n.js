import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const dict = {
  en: {
    appName: "RTKM Fuel Planner",
    tagline: "Fuel Planner",
    login: "Log in",
    synced: "Up to date",
    cached: "pumps saved",
    openMaps: "Open pump in Maps",
    noCoords: "Location not added for this pump yet.",
    pickPumpHint: "Pick a pump to see diesel needed",
    depot: "Select Depot",
    pump: "Pump name or code",
    startTyping: "Start typing…",
    mileage: "Mileage (km/L)",
    roCode: "RO Code",
    rtkm: "Distance (RTKM)",
    diesel: "Diesel needed",
    dieselPrice: "Diesel price (₹/L)",
    pricePlaceholder: "Enter price ₹/L",
    totalAmount: "Total amount",
    enterPriceHint: "Enter diesel price to see total",
    city: "City",
    litre: "litre",
    km: "km",
    details: "View details & open in Maps",
    addMissing: "Add a missing pump",
    submit: "Submit",
    cancel: "Cancel",
    name: "Your name (optional)",
    yourPhone: "Your phone (optional)",
    address: "Address",
    submittedOk: "Thanks! Sent for admin approval.",
    offline: "Offline — using saved data",
  },
  hi: {
    appName: "आरटीकेएम ईंधन प्लानर",
    tagline: "ईंधन प्लानर",
    login: "लॉगिन",
    synced: "अप-टू-डेट",
    cached: "पंप सेव हैं",
    openMaps: "पंप को मैप में खोलें",
    noCoords: "इस पंप का लोकेशन अभी नहीं जोड़ा गया।",
    pickPumpHint: "डीज़ल देखने के लिए पंप चुनें",
    depot: "डिपो चुनें",
    pump: "पंप का नाम या कोड",
    startTyping: "टाइप करना शुरू करें…",
    mileage: "माइलेज (किमी/लीटर)",
    roCode: "आरओ कोड",
    rtkm: "दूरी (आरटीकेएम)",
    diesel: "डीज़ल ज़रूरत",
    dieselPrice: "डीज़ल भाव (₹/लीटर)",
    pricePlaceholder: "भाव ₹/लीटर डालें",
    totalAmount: "कुल राशि",
    enterPriceHint: "कुल राशि देखने के लिए भाव डालें",
    city: "शहर",
    litre: "लीटर",
    km: "किमी",
    details: "विवरण देखें और नक्शे में खोलें",
    addMissing: "नया पंप जोड़ें",
    submit: "भेजें",
    cancel: "रद्द करें",
    name: "आपका नाम (वैकल्पिक)",
    yourPhone: "आपका फ़ोन (वैकल्पिक)",
    address: "पता",
    submittedOk: "धन्यवाद! एडमिन अनुमोदन के लिए भेजा गया।",
    offline: "ऑफ़लाइन — सहेजा डेटा",
  },
};

export function useI18n() {
  const [lang, setLang] = useState("en");
  useEffect(() => {
    AsyncStorage.getItem("rtkm-lang").then((l) => { if (l === "hi" || l === "en") setLang(l); });
  }, []);
  const change = (l) => { setLang(l); AsyncStorage.setItem("rtkm-lang", l); };
  const t = (key) => dict[lang][key] ?? dict.en[key] ?? key;
  return { lang, setLang: change, t };
}
