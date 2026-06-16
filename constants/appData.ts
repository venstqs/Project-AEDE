export const APP_COLORS = {
  primary: '#0EA5E9',
  secondary: '#2563EB',
  accent: '#F59E0B',
  danger: '#EF4444',
  success: '#10B981',
  pink: '#EC4899',
  white: '#FFFFFF',
  slate: '#0F172A',
  slateLight: '#64748B',
  slateDark: '#0C4A6E',
  bg: '#F8FAFC',
};

export type OfficialPost = {
  id: string;
  author: string;
  role: string;
  time: string;
  content: string;
  location: string;
  likes: number;
  comments: number;
  verified: boolean;
  type: 'alert' | 'update' | 'social';
  isOfficial?: boolean;
  pinned?: boolean;
  status?: 'verified' | 'pending-review';
};

export const OFFICIAL_COMMUNITY_POSTS: OfficialPost[] = [
  {
    id: '1',
    author: 'Naga City Health Office',
    role: 'Verified Public Health Advisory',
    time: 'Pinned',
    content:
      'Priority advisory: Dayangdang shows elevated dengue-vector risk. Clear containers, inspect drains, and report persistent stagnant water through the app.',
    location: 'Dayangdang, Naga City',
    likes: 0,
    comments: 0,
    verified: true,
    isOfficial: true,
    type: 'alert',
    pinned: true,
    status: 'verified',
  },
  {
    id: '2',
    author: 'Naga CDRRMO',
    role: 'Verified Operations Bulletin',
    time: 'Pinned',
    content:
      'Rainfall watch remains active for low-lying barangays. Field teams are prioritizing drainage checks near market and school corridors.',
    location: 'Naga City Command Center',
    likes: 0,
    comments: 0,
    verified: true,
    isOfficial: true,
    type: 'update',
    pinned: true,
    status: 'verified',
  },
  {
    id: '3',
    author: 'Barangay Health Emergency Response Team',
    role: 'Verified Field Update',
    time: 'Today',
    content:
      'Larval source reduction sweep completed in Tabuco Market perimeter. Follow-up inspection scheduled after the next rainfall window.',
    location: 'Tabuco Market',
    likes: 0,
    comments: 0,
    verified: true,
    isOfficial: true,
    type: 'update',
    status: 'verified',
  },
  {
    id: '4',
    author: 'DOH Region V — Vector Control',
    role: 'Verified Regional Advisory',
    time: 'Today',
    content:
      'Bicol region dengue watch: maintain 4S protocol (Search & destroy, Self-protection, Seek consultation, Say yes to fogging when advised). Hotline 911 for emergencies.',
    location: 'Regional Operations Center',
    likes: 0,
    comments: 0,
    verified: true,
    isOfficial: true,
    type: 'alert',
    status: 'verified',
  },
  {
    id: '5',
    author: 'Bicol Medical Center',
    role: 'Verified Hospital Bulletin',
    time: 'Yesterday',
    content:
      'BMC triage capacity stable. Suspected dengue cases should present early; hydration kits available at outpatient desk 06:00–22:00.',
    location: 'Bicol Medical Center',
    likes: 0,
    comments: 0,
    verified: true,
    isOfficial: true,
    type: 'update',
    status: 'verified',
  },
  {
    id: '6',
    author: 'Naga City Dengue Task Force',
    role: 'Verified Campaign Update',
    time: 'Yesterday',
    content:
      'Oplan Kulobong launched in Peñafrancia and San Felipe: household inspections 08:00–17:00. Cooperate with barangay tanods wearing AEDE vests.',
    location: 'Peñafrancia · San Felipe',
    likes: 0,
    comments: 0,
    verified: true,
    isOfficial: true,
    type: 'update',
    status: 'verified',
  },
  {
    id: '7',
    author: 'Ateneo de Naga — Campus Health',
    role: 'Verified Institutional Advisory',
    time: '2 days ago',
    content:
      'Campus perimeter fogging completed. Students: empty cups and bottles in dormitories; report clogged gutters to Health Services.',
    location: 'Ateneo de Naga University',
    likes: 0,
    comments: 0,
    verified: true,
    isOfficial: true,
    type: 'update',
    status: 'verified',
  },
  {
    id: '8',
    author: 'CHED Bicol — School Safety',
    role: 'Verified Education Sector Alert',
    time: '2 days ago',
    content:
      'All HEIs in Naga: mandatory weekly container inspection logs due Fridays. Template available from City Health liaison.',
    location: 'Naga City Hall — CHED Desk',
    likes: 0,
    comments: 0,
    verified: true,
    isOfficial: true,
    type: 'alert',
    status: 'verified',
  },
  {
    id: 'sg_1',
    author: 'NEA Singapore',
    role: 'Verified National Agency',
    time: 'Pinned',
    content:
      'Dengue cases are rising in Jurong West. We urge residents to practice the Mozzie Wipeout. Check flower pots and gully traps daily.',
    location: 'Jurong West, Singapore',
    likes: 0,
    comments: 0,
    verified: true,
    isOfficial: true,
    type: 'alert',
    pinned: true,
    status: 'verified',
  },
  {
    id: 'sg_2',
    author: 'SGH Outbreak Control',
    role: 'Verified Healthcare Hub',
    time: 'Yesterday',
    content:
      'SGH emergency department has seen a 15% increase in dengue-related visits. Please seek medical attention early if you have a prolonged fever.',
    location: 'Singapore General Hospital (SGH)',
    likes: 0,
    comments: 0,
    verified: true,
    isOfficial: true,
    type: 'update',
    status: 'verified',
  },
  {
    id: 'user_1',
    author: 'Juan Dela Cruz',
    role: 'Guardian Cadet',
    time: '2 hours ago',
    content:
      'Hey neighbors, I found a discarded tire near the old basketball court in Dayangdang filled with rainwater and some wrigglers. Already submitted a photo report to the AI engine for the barangay officials!',
    location: 'Dayangdang, Naga City',
    likes: 12,
    comments: 3,
    verified: false,
    isOfficial: false,
    type: 'social',
    status: 'verified',
  },
  {
    id: 'user_2',
    author: 'Maria Santos',
    role: 'Guardian Sentinel',
    time: '5 hours ago',
    content:
      'Just finished my daily prevention habit shield! Covered all the water drums in my backyard. Stay safe everyone, Dengue is no joke.',
    location: 'San Felipe, Naga City',
    likes: 24,
    comments: 5,
    verified: false,
    isOfficial: false,
    type: 'social',
    status: 'verified',
  },
  {
    id: 'sg_user_1',
    author: 'Lim Wei Chen',
    role: 'Guardian Cadet',
    time: 'Yesterday',
    content:
      'Spotted some water accumulation in the corridor drains at Jurong West Blk 451. Just used the AEDE vision scanner to report it. Keep our corridors dry!',
    location: 'Jurong West, Singapore',
    likes: 8,
    comments: 1,
    verified: false,
    isOfficial: false,
    type: 'social',
    status: 'verified',
  }
];

export const BARANGAY_AI_METRICS: Record<
  string,
  {
    temp: string;
    humid: string;
    loss: string;
    latency: string;
    surgeProb: string;
    surgeDays: string;
    ndwi: string;
    evi: string;
    caseNow: string;
    baseline: string;
    ciLow: string;
    ciHigh: string;
    riskLevel: 'Critical' | 'Elevated' | 'Moderate' | 'Low';
    actions: string[];
  }
> = {
  Dayangdang: {
    temp: '29.4',
    humid: '88.2',
    loss: '0.042',
    latency: '12ms',
    surgeProb: '84%',
    surgeDays: 'T+12 Days',
    ndwi: '0.42',
    evi: '0.36',
    caseNow: '41',
    baseline: '18',
    ciLow: '64',
    ciHigh: '91',
    riskLevel: 'Critical',
    actions: [
      'Deploy Ovicidal-Larvicidal traps in Zone 4',
      'Schedule fogging window with barangay captain',
      'Push door-to-door container audit today',
    ],
  },
  Tabuco: {
    temp: '31.2',
    humid: '76.0',
    loss: '0.018',
    latency: '9ms',
    surgeProb: '42%',
    surgeDays: 'Stable',
    ndwi: '0.12',
    evi: '0.58',
    caseNow: '3',
    baseline: '9',
    ciLow: '28',
    ciHigh: '55',
    riskLevel: 'Low',
    actions: [
      'Maintain weekly drain clearance near market',
      'Continue Sentinel-2 moisture watch',
      'Share low-risk status to community feed',
    ],
  },
  'San Felipe': {
    temp: '30.1',
    humid: '79.0',
    loss: '0.028',
    latency: '11ms',
    surgeProb: '58%',
    surgeDays: 'T+9 Days',
    ndwi: '0.31',
    evi: '0.41',
    caseNow: '12',
    baseline: '8',
    ciLow: '45',
    ciHigh: '72',
    riskLevel: 'Moderate',
    actions: [
      'Inspect school perimeter containers',
      'Coordinate with CHED weekly log submission',
    ],
  },
  'Concepcion Pequeña': {
    temp: '28.8',
    humid: '91.0',
    loss: '0.051',
    latency: '14ms',
    surgeProb: '72%',
    surgeDays: 'T+7 Days',
    ndwi: '0.48',
    evi: '0.29',
    caseNow: '19',
    baseline: '10',
    ciLow: '55',
    ciHigh: '85',
    riskLevel: 'Elevated',
    actions: [
      'Prioritize rooftop water tank checks',
      'Enable AEDE daily checklist for residents',
    ],
  },
  Peñafrancia: {
    temp: '29.0',
    humid: '85.5',
    loss: '0.035',
    latency: '10ms',
    surgeProb: '61%',
    surgeDays: 'T+10 Days',
    ndwi: '0.38',
    evi: '0.33',
    caseNow: '15',
    baseline: '9',
    ciLow: '48',
    ciHigh: '78',
    riskLevel: 'Moderate',
    actions: ['Support Oplan Kulobong household visits', 'Map stagnant sites on risk map'],
  },
  Balatas: {
    temp: '28.5',
    humid: '92.1',
    loss: '0.065',
    latency: '18ms',
    surgeProb: '91%',
    surgeDays: 'T+4 Days',
    ndwi: '0.55',
    evi: '0.31',
    caseNow: '26',
    baseline: '11',
    ciLow: '74',
    ciHigh: '96',
    riskLevel: 'Critical',
    actions: [
      'Escalate to CDRRMO field team within 24h',
      'Issue barangay-wide SMS advisory',
      'Open temporary hydration station if cases rise',
    ],
  },
};

export const HOME_DIRECTIVES = [
  { id: '1', text: 'Empty pooled water in containers & flower pots', route: '/report', done: true },
  { id: '2', text: 'Inspect outdoor gutters and search for stagnant pools', route: '/map', done: false },
  { id: '3', text: 'Apply insect repellent (Self-protection shield)', route: '/profile', done: false },
  { id: '4', text: 'Perform 4 O\'Clock container search-and-destroy', route: '/report', done: false },
];

export const CHAT_SUGGESTIONS = [
  'What should I do in Dayangdang today?',
  'Give me a 5-step prevention checklist.',
  'Explain the surge probability for my barangay.',
  'When should I seek medical care?',
];
