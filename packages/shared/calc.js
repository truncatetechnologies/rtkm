// Core calculation, identical on web and mobile.
// Oil consumed (liters) = RTKM (round-trip km) / average (km per liter).

function calcOil(rtkm, average) {
  const r = parseFloat(rtkm);
  const a = parseFloat(average);
  if (!isFinite(r) || !isFinite(a) || a <= 0) return null;
  return r / a;
}

// Formatted to 2 decimals, matching the original app's `.toFixed(2)`.
function calcOilFixed(rtkm, average) {
  const v = calcOil(rtkm, average);
  return v == null ? "0.00" : v.toFixed(2);
}

module.exports = { calcOil, calcOilFixed };
