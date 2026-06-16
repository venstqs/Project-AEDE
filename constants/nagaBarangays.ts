export type BarangayRiskData = {
  id: string;
  brgyCode: string;
  name: string;
  lat: number;
  lng: number;
  riskScore: number;
};

/** 27 official barangays of Naga City — shared with Map & AI Engine */
export const NAGA_BARANGAYS: BarangayRiskData[] = [
  { id: '051724001', brgyCode: '051724001', name: 'Abella', lat: 13.6210, lng: 123.1780, riskScore: 0.25 },
  { id: '051724002', brgyCode: '051724002', name: 'Bagumbayan Norte', lat: 13.6270, lng: 123.1830, riskScore: 0.45 },
  { id: '051724003', brgyCode: '051724003', name: 'Bagumbayan Sur', lat: 13.6240, lng: 123.1800, riskScore: 0.15 },
  { id: '051724004', brgyCode: '051724004', name: 'Balatas', lat: 13.6260, lng: 123.2000, riskScore: 0.65 },
  { id: '051724006', brgyCode: '051724006', name: 'Calauag', lat: 13.6330, lng: 123.1860, riskScore: 0.55 },
  { id: '051724007', brgyCode: '051724007', name: 'Cararayan', lat: 13.6280, lng: 123.2180, riskScore: 0.35 },
  { id: '051724008', brgyCode: '051724008', name: 'Carolina', lat: 13.6550, lng: 123.2450, riskScore: 0.10 },
  { id: '051724009', brgyCode: '051724009', name: 'Concepcion Grande', lat: 13.6120, lng: 123.2080, riskScore: 0.75 },
  { id: '051724010', brgyCode: '051724010', name: 'Concepcion Pequeña', lat: 13.6130, lng: 123.1950, riskScore: 0.85 },
  { id: '051724011', brgyCode: '051724011', name: 'Dayangdang', lat: 13.6245, lng: 123.1870, riskScore: 0.90 },
  { id: '051724012', brgyCode: '051724012', name: 'Del Rosario', lat: 13.5980, lng: 123.2150, riskScore: 0.40 },
  { id: '051724013', brgyCode: '051724013', name: 'Dinaga', lat: 13.6225, lng: 123.1870, riskScore: 0.20 },
  { id: '051724014', brgyCode: '051724014', name: 'Igualdad Interior', lat: 13.6205, lng: 123.1860, riskScore: 0.30 },
  { id: '051724017', brgyCode: '051724017', name: 'Lerma', lat: 13.6255, lng: 123.1890, riskScore: 0.80 },
  { id: '051724018', brgyCode: '051724018', name: 'Liboton', lat: 13.6290, lng: 123.1810, riskScore: 0.50 },
  { id: '051724019', brgyCode: '051724019', name: 'Mabolo', lat: 13.6060, lng: 123.1740, riskScore: 0.30 },
  { id: '051724020', brgyCode: '051724020', name: 'Pacol', lat: 13.6450, lng: 123.2080, riskScore: 0.15 },
  { id: '051724023', brgyCode: '051724023', name: 'Panicuason', lat: 13.6650, lng: 123.2850, riskScore: 0.05 },
  { id: '051724024', brgyCode: '051724024', name: 'Peñafrancia', lat: 13.6330, lng: 123.1930, riskScore: 0.60 },
  { id: '051724025', brgyCode: '051724025', name: 'Sabang', lat: 13.6170, lng: 123.1770, riskScore: 0.70 },
  { id: '051724026', brgyCode: '051724026', name: 'San Felipe', lat: 13.6400, lng: 123.1940, riskScore: 0.50 },
  { id: '051724027', brgyCode: '051724027', name: 'San Francisco (Pob.)', lat: 13.6235, lng: 123.1865, riskScore: 0.40 },
  { id: '051724028', brgyCode: '051724028', name: 'San Isidro', lat: 13.6190, lng: 123.2380, riskScore: 0.20 },
  { id: '051724029', brgyCode: '051724029', name: 'Santa Cruz', lat: 13.6250, lng: 123.1730, riskScore: 0.35 },
  { id: '051724030', brgyCode: '051724030', name: 'Tabuco', lat: 13.6110, lng: 123.1830, riskScore: 0.25 },
  { id: '051724031', brgyCode: '051724031', name: 'Tinago', lat: 13.6235, lng: 123.1895, riskScore: 0.65 },
  { id: '051724032', brgyCode: '051724032', name: 'Triangulo', lat: 13.6110, lng: 123.1900, riskScore: 0.55 },
];

export type RiskLevel = 'Critical' | 'Elevated' | 'Moderate' | 'Low';

export function getRiskLevel(score: number): RiskLevel {
  if (score >= 0.8) return 'Critical';
  if (score >= 0.6) return 'Elevated';
  if (score >= 0.35) return 'Moderate';
  return 'Low';
}

/** Classic map risk colors (green → amber → red) — Map & IoT use this */
export const MAP_RISK_COLORS = {
  low: '#10B981',
  moderate: '#F59E0B',
  high: '#EF4444',
} as const;

export function getColorForRisk(score: number): string {
  if (score <= 0.3) return MAP_RISK_COLORS.low;
  if (score <= 0.7) return MAP_RISK_COLORS.moderate;
  return MAP_RISK_COLORS.high;
}

/** Map popup / legend labels */
export function getMapRiskLabel(score: number): string {
  if (score <= 0.3) return 'Low';
  if (score <= 0.7) return 'Moderate';
  return 'High';
}

/** @deprecated Use getMapRiskLabel for map; getRiskLevel for AI copy */
export function getRiskLabel(score: number): string {
  return getMapRiskLabel(score);
}

/** @deprecated Use getColorForRisk — same as map */
export const getRiskBlue = getColorForRisk;

export function buildIotMetricsFromRisk(b: BarangayRiskData) {
  const seed = b.name.length + Math.round(b.riskScore * 100);
  const surge = Math.round(b.riskScore * 100);
  const level = getRiskLevel(b.riskScore);
  return {
    temp: (27 + b.riskScore * 3.5 + (seed % 3) * 0.1).toFixed(1),
    humid: Math.round(65 + b.riskScore * 18).toString(),
    loss: (0.01 + b.riskScore * 0.06).toFixed(3),
    latency: `${8 + (seed % 12)}ms`,
    surgeProb: `${surge}%`,
    surgeDays: surge >= 75 ? `T+${Math.max(4, 14 - Math.floor(surge / 8))} Days` : surge >= 50 ? 'Watch' : 'Stable',
    ndwi: (0.1 + b.riskScore * 0.45).toFixed(2),
    evi: (0.55 - b.riskScore * 0.25).toFixed(2),
    caseNow: String(b.name === 'Dayangdang' ? 2 : 0), // Default to 0 cases globally (clinical diagnostic truth), except Dayangdang starts with 2 mild baseline cases
    baseline: "10", // Seasonally expected standard baseline caseload
    ciLow: String(Math.max(20, surge - 18)),
    ciHigh: String(Math.min(98, surge + 12)),
    riskLevel: level,
    riskScore: b.riskScore,
    actions: [
      `Review IoT nodes in ${b.name}`,
      b.riskScore > 0.6 ? 'Coordinate LGU field visit within 48h' : 'Maintain weekly container checks',
      'Open risk map for H3 zone boundaries',
    ],
  };
}
