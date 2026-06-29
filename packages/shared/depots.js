// Depot list and the selectable averages (km/L), mirroring the original app.
const DEPOTS = [
  { slug: "kanpur-nayara", name: "Kanpur Nayara" },
  { slug: "mughalsarai-nayara", name: "Mughalsarai Nayara" },
  { slug: "mughalsarai-BPCL", name: "Mughalsarai BPCL" },
];

// The original app offered 3 -> 6 km/L in 0.5 increments.
const AVERAGES = [3, 3.5, 4, 4.5, 5, 5.5, 6];

function depotName(slug) {
  const d = DEPOTS.find((x) => x.slug === slug);
  return d ? d.name : slug;
}

module.exports = { DEPOTS, AVERAGES, depotName };
