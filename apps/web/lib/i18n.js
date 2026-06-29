"use client";
import { useEffect, useState } from "react";

// Driver-facing strings in English + Hindi. Keep wording plain and short.
export const dict = {
  en: {
    appName: "RTKM Fuel Planner",
    tagline: "Find diesel needed for your trip",
    depot: "Select Depot",
    pump: "Pump name or code",
    startTyping: "Start typing…",
    mileage: "Mileage (km per litre)",
    roCode: "RO Code",
    rtkm: "Distance (RTKM)",
    diesel: "Diesel needed",
    pickPumpHint: "Pick a pump to see diesel",
    dieselPrice: "Diesel price (₹ per litre)",
    pricePlaceholder: "Enter price ₹/L",
    totalAmount: "Total amount",
    enterPriceHint: "Enter diesel price to see total",
    city: "City",
    address: "Address",
    litre: "litre",
    km: "km",
    openMaps: "Open pump in Maps",
    noCoords: "Location not added yet",
    addMissing: "Add a missing pump",
    pumpNotListed: "Pump not in the list?",
    submit: "Submit",
    cancel: "Cancel",
    name: "Your name (optional)",
    yourPhone: "Your phone (optional)",
    sending: "Sending…",
    submittedOk: "Thanks! Sent for admin approval.",
    ownerLogin: "Log in",
    loginHint: "Driver, manager or owner? Log in",
    adminLogin: "Admin",
    searching: "Searching…",
  },
  hi: {
    appName: "आरटीकेएम ईंधन प्लानर",
    tagline: "अपनी यात्रा के लिए डीज़ल जानें",
    depot: "डिपो चुनें",
    pump: "पंप का नाम या कोड",
    startTyping: "टाइप करना शुरू करें…",
    mileage: "माइलेज (किमी प्रति लीटर)",
    roCode: "आरओ कोड",
    rtkm: "दूरी (आरटीकेएम)",
    diesel: "डीज़ल ज़रूरत",
    pickPumpHint: "डीज़ल देखने के लिए पंप चुनें",
    dieselPrice: "डीज़ल भाव (₹ प्रति लीटर)",
    pricePlaceholder: "भाव ₹/लीटर डालें",
    totalAmount: "कुल राशि",
    enterPriceHint: "कुल राशि देखने के लिए भाव डालें",
    city: "शहर",
    address: "पता",
    litre: "लीटर",
    km: "किमी",
    openMaps: "नक्शे में पंप खोलें",
    noCoords: "लोकेशन अभी नहीं जोड़ी गई",
    addMissing: "नया पंप जोड़ें",
    pumpNotListed: "पंप सूची में नहीं है?",
    submit: "भेजें",
    cancel: "रद्द करें",
    name: "आपका नाम (वैकल्पिक)",
    yourPhone: "आपका फ़ोन (वैकल्पिक)",
    sending: "भेजा जा रहा है…",
    submittedOk: "धन्यवाद! एडमिन अनुमोदन के लिए भेजा गया।",
    ownerLogin: "लॉगिन",
    loginHint: "ड्राइवर, मैनेजर या मालिक? लॉगिन करें",
    adminLogin: "एडमिन",
    searching: "खोज रहे हैं…",
  },
};

// Tiny hook: remembers the chosen language in localStorage.
export function useI18n() {
  const [lang, setLang] = useState("en");
  useEffect(() => {
    const saved = localStorage.getItem("rtkm-lang");
    if (saved === "hi" || saved === "en") setLang(saved);
  }, []);
  const change = (l) => { setLang(l); localStorage.setItem("rtkm-lang", l); };
  const t = (key) => dict[lang][key] ?? dict.en[key] ?? key;
  return { lang, setLang: change, t };
}
