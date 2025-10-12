export const TIERS = [
  { name: "Observer",   min: 0,     max: 1000 },
  { name: "Forecaster", min: 1000,  max: 5000 },
  { name: "Prophet",    min: 5000,  max: 10000 },
  { name: "Oracle",     min: 10000, max: 15000 },
  { name: "Singularity",min: 15000, max: Infinity },
] as const
