// NAura forests — plain-language data, real photos, worldwide planting sites
const U = (id, w = 1200) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=72`;

// rotating pool of aerial / forest photography
const P = {
  aerialGreen: "1542273917363-3b1817f69a2d",
  canopy:      "1511497584788-876760111969",
  sunbeams:    "1448375240586-882707db888b",
  mountain:    "1469474968028-56623f02e42e",
  pines:       "1441974231531-c6227db76b6e",
  valley:      "1426604966848-d7adac402bff",
  path:        "1502082553048-f009c37129b9",
  fields:      "1473448912268-2022ce9509d8",
  sunforest:   "1518495973542-4542c06a5843",
  misty:       "1497250681960-ef046c08a56e",
  autumn:      "1416879595882-3373a0480b5b",
  river:       "1444492417251-9c84a5fa18e0"
};

export const FORESTS = [
  { id: "maremma",  name: "Maremma Woodland",   place: "Tuscany — Italy",        flag: "Italy",      lat: 42.716, lng: 11.114,  health: 38, target: 52, setAside: 15,  paid: 0,    hue: 150, photo: U(P.misty),     story: "Old mining land brought back to life with native Mediterranean trees, planted by local hands." },
  { id: "mau",      name: "Mau Forest",         place: "Rift Valley — Kenya",    flag: "Kenya",      lat: -0.633, lng: 35.833,  health: 48, target: 55, setAside: 45,  paid: 12.5, hue: 130, photo: U(P.sunbeams),  story: "Replanting a vital water forest, led by the communities who depend on the rivers it feeds." },
  { id: "xingu",    name: "Xingu River Forest", place: "Mato Grosso — Brazil",   flag: "Brazil",     lat: -11.524, lng: -53.189, health: 51, target: 60, setAside: 120, paid: 40,   hue: 160, photo: U(P.canopy),    story: "Reconnecting broken patches of Amazon rainforest so wildlife can move freely again." },
  { id: "borneo",   name: "Borneo Lowland",     place: "Kalimantan — Indonesia", flag: "Indonesia",  lat: 0.96,   lng: 114.55,  health: 44, target: 58, setAside: 80,  paid: 18,   hue: 145, photo: U(P.sunforest), story: "Restoring tropical lowland rainforest and peatland that shelters orangutans and hornbills." },
  { id: "bialowieza", name: "Białowieża",       place: "Podlaskie — Poland",     flag: "Poland",     lat: 52.7,   lng: 23.87,   health: 55, target: 62, setAside: 30,  paid: 9,    hue: 125, photo: U(P.pines),     story: "Protecting one of Europe's last primeval forests, home to wild bison and ancient oaks." },
  { id: "daintree", name: "Daintree",           place: "Queensland — Australia", flag: "Australia",  lat: -16.17, lng: 145.4,   health: 49, target: 60, setAside: 60,  paid: 14,   hue: 155, photo: U(P.path),      story: "Healing the world's oldest tropical rainforest after decades of clearing and cyclones." },
  { id: "congo",    name: "Congo Basin",        place: "Équateur — DR Congo",    flag: "DR Congo",   lat: -0.5,   lng: 23.5,    health: 53, target: 63, setAside: 140, paid: 32,   hue: 158, photo: U(P.valley),    story: "Safeguarding the planet's second-largest rainforest and the people who live within it." },
  { id: "ghats",    name: "Western Ghats",      place: "Karnataka — India",      flag: "India",      lat: 13.0,   lng: 75.5,    health: 46, target: 57, setAside: 55,  paid: 11,   hue: 140, photo: U(P.river),     story: "Replanting monsoon hill forest, a biodiversity hotspot feeding rivers for millions." },
  { id: "redwood",  name: "Redwood Coast",      place: "California — USA",       flag: "USA",        lat: 41.2,   lng: -124.0,  health: 58, target: 65, setAside: 90,  paid: 28,   hue: 150, photo: U(P.mountain),  story: "Bringing back coastal redwoods — the tallest living things on Earth — after old logging." },
  { id: "highlands", name: "Scottish Highlands", place: "Inverness — Scotland",  flag: "Scotland",   lat: 57.0,   lng: -4.5,    health: 35, target: 50, setAside: 25,  paid: 4,    hue: 120, photo: U(P.autumn),    story: "Regrowing the lost Caledonian pine forest across bare, windswept Highland glens." },
  { id: "patagonia", name: "Patagonia Andes",   place: "Los Lagos — Chile",      flag: "Chile",      lat: -41.5,  lng: -72.5,   health: 50, target: 60, setAside: 70,  paid: 20,   hue: 148, photo: U(P.fields),    story: "Restoring native lenga and coihue forest on slopes scarred by historic wildfires." },
  { id: "atlantic", name: "Atlantic Forest",    place: "Bahia — Brazil",         flag: "Brazil",     lat: -14.8,  lng: -39.0,   health: 42, target: 56, setAside: 65,  paid: 16,   hue: 162, photo: U(P.aerialGreen), story: "Rebuilding the Mata Atlântica, one of the richest yet most threatened forests on Earth." }
];

export const goalProgress = (f) => Math.min(100, Math.round((f.health / f.target) * 100));
export const fmt = (n) => Number(n).toFixed(2);
export const photoFor = (f, w = 1200) => {
  // re-fetch at a chosen width by swapping the w= param
  return f.photo.replace(/w=\d+/, `w=${w}`);
};
