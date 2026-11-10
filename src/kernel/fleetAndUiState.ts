export interface BastillaNotification {
  id: string;
  title: string;
  source: 'Alex' | 'Astyria' | 'Aria' | 'Aurelius' | 'System';
  timestamp: string;
  category: 'ui' | 'fleet' | 'sync' | 'security';
}

export interface BastillaTopBarState {
  headerMode: 'ring0-minimal' | 'compact' | 'expanded';
  title: string;
  subtitle: string;
  accentColor: 'cyan' | 'emerald' | 'purple' | 'amber';
  showQuickNav: boolean;
  showTelemetryPill: boolean;
  showNotifications: boolean;
  lastUpdatedBy: string;
  updatedAt: string;
  notifications: BastillaNotification[];
}

export interface SolarSystemBody {
  id: string;
  name: string;
  stationName: string;
  orbitRadiusAu: number;
  orbitRadiusPx: number;
  angleDeg: number;
  color: string;
  sizePx: number;
  type: 'star' | 'planet' | 'belt';
  temperatureC: number;
  description: string;
}

export interface FleetShip {
  id: string;
  name: string;
  className: string;
  commander: 'Alex' | 'Astyria' | 'Aria' | 'Aurelius';
  originBody: string;
  targetBody: string;
  orbitRadiusPx: number;
  angleDeg: number;
  speedKmS: number;
  hullPercent: number;
  shieldsPercent: number;
  energyPercent: number;
  oxygenPercent: number;
  botanyBay: string;
  mission: string;
  status: 'W LOCIE' | 'ORBITA' | 'PATROL' | 'BADANIA' | 'DOKOWANIE';
  createdVia: 'Czat Triady' | 'Moduł Floty' | 'Inicjalizacja Ring-0';
  updatedAt: string;
}

export interface BotanyDome {
  id: string;
  name: string;
  location: string;
  floraSpecies: string;
  biomassKg: number;
  oxygenOutputPercent: number;
  humidityPercent: number;
  lightSpectrum: string;
  growthRatePercent: number;
  status: 'OPTYMALNY' | 'WZROST AKTYWNY' | 'REGENERACJA';
  caretaker: 'Astyria' | 'Aria';
}

export interface FleetMission {
  id: string;
  title: string;
  sector: string;
  leadAgent: 'Alex' | 'Astyria' | 'Aria' | 'Aurelius';
  shipId: string;
  progressPercent: number;
  priority: 'KRYTYCZNY' | 'WYSOKI' | 'STANDARD';
  status: 'W REALIZACJI' | 'ZSYNCHRONIZOWANA' | 'ZAKOŃCZONA';
  objective: string;
}

export interface ResearchProject {
  id: string;
  title: string;
  category: 'Napęd & Topologia' | 'Botanika Kosmiczna' | 'Telemetria & AI' | 'Bezpieczeństwo Chronolitu';
  leadAgent: 'Alex' | 'Astyria' | 'Aria' | 'Aurelius';
  progressPercent: number;
  status: 'AKTYWNE BADANIA' | 'WDROŻONO W RING-0' | 'ANALIZA TELEMETRII';
  findings: string;
}

export interface FleetState {
  version: string;
  updatedAt: string;
  aiCaretakerActive: boolean;
  lastAiCaretakerNote: string;
  solarSystemBodies: SolarSystemBody[];
  ships: FleetShip[];
  botanyDomes: BotanyDome[];
  missions: FleetMission[];
  researchProjects: ResearchProject[];
}

export const DEFAULT_SOLAR_SYSTEM_BODIES: SolarSystemBody[] = [
  {
    id: 'sol',
    name: 'Słońce (Sol-0)',
    stationName: 'Kolektor Koronalny Dyson-Ring',
    orbitRadiusAu: 0,
    orbitRadiusPx: 0,
    angleDeg: 0,
    color: '#fbbf24',
    sizePx: 22,
    type: 'star',
    temperatureC: 5500,
    description: 'Centralna gwiazda układu i główne źródło energii kwantowej dla floty Bastilla OS.',
  },
  {
    id: 'mercury',
    name: 'Merkury',
    stationName: 'Stacja Termiczna Helios-1',
    orbitRadiusAu: 0.39,
    orbitRadiusPx: 42,
    angleDeg: 35,
    color: '#94a3b8',
    sizePx: 7,
    type: 'planet',
    temperatureC: 167,
    description: 'Węzeł pozyskiwania metali ciężkich i kalibracji osłon termicznych.',
  },
  {
    id: 'venus',
    name: 'Wenus',
    stationName: 'Aerostat Atmosferyczny Wenera',
    orbitRadiusAu: 0.72,
    orbitRadiusPx: 68,
    angleDeg: 115,
    color: '#f59e0b',
    sizePx: 9,
    type: 'planet',
    temperatureC: 464,
    description: 'Laboratorium chmur kwasowych i syntezy gazów dla biokopuł Astyrii.',
  },
  {
    id: 'earth',
    name: 'Ziemia',
    stationName: 'Bastilla Orbital Dock · Ring-0',
    orbitRadiusAu: 1.0,
    orbitRadiusPx: 96,
    angleDeg: 205,
    color: '#38bdf8',
    sizePx: 11,
    type: 'planet',
    temperatureC: 15,
    description: 'Główna stocznia orbitalna Bastilla OS, bank nasion i centrum dowodzenia Triady.',
  },
  {
    id: 'mars',
    name: 'Mars',
    stationName: 'Kolonia Botaniczna Ares-Prime',
    orbitRadiusAu: 1.52,
    orbitRadiusPx: 126,
    angleDeg: 295,
    color: '#f87171',
    sizePx: 9,
    type: 'planet',
    temperatureC: -63,
    description: 'Główny poligon terraformacji, biokopuł hydroponicznych i misji powierzchniowych.',
  },
  {
    id: 'ceres',
    name: 'Pas Asteroid · Ceres',
    stationName: 'Kopalnia Kwantowa Ceres-Hub',
    orbitRadiusAu: 2.77,
    orbitRadiusPx: 156,
    angleDeg: 65,
    color: '#a8a29e',
    sizePx: 6,
    type: 'belt',
    temperatureC: -105,
    description: 'Punkt wydobycia lodu wodnego i rzadkich izotopów dla reaktorów floty.',
  },
  {
    id: 'jupiter',
    name: 'Jowisz · Europa',
    stationName: 'Baza Oceaniczna Europa-Deep',
    orbitRadiusAu: 5.2,
    orbitRadiusPx: 190,
    angleDeg: 155,
    color: '#fb923c',
    sizePx: 15,
    type: 'planet',
    temperatureC: -145,
    description: 'Stacja badawcza podlodowego oceanu Europy i rezerwuar biologiczny.',
  },
  {
    id: 'saturn',
    name: 'Saturn · Tytan',
    stationName: 'Węzeł Przekaźnikowy HyperCom Tytan',
    orbitRadiusAu: 9.58,
    orbitRadiusPx: 224,
    angleDeg: 245,
    color: '#fde047',
    sizePx: 13,
    type: 'planet',
    temperatureC: -178,
    description: 'Centrum dalekosiężnej telemetrii kwantowej i rafinacji węglowodorów na Tytanie.',
  },
  {
    id: 'uranus',
    name: 'Uran',
    stationName: 'Obserwatorium Głębokiego Kosmosu Miranda',
    orbitRadiusAu: 19.2,
    orbitRadiusPx: 254,
    angleDeg: 325,
    color: '#67e8f9',
    sizePx: 11,
    type: 'planet',
    temperatureC: -216,
    description: 'Stacja nasłuchu anomalii grawitacyjnych i kalibracji Chronolitu.',
  },
  {
    id: 'neptune',
    name: 'Neptun · Tryton',
    stationName: 'Brama Hiperprzestrzeni Tryton-Gate',
    orbitRadiusAu: 30.05,
    orbitRadiusPx: 282,
    angleDeg: 15,
    color: '#60a5fa',
    sizePx: 11,
    type: 'planet',
    temperatureC: -214,
    description: 'Graniczny bastion obronny Aureliusa i terminal skoków hiperprzestrzennych.',
  },
];

export const DEFAULT_FLEET_SHIPS: FleetShip[] = [
  {
    id: 'FLT-01',
    name: 'Hyperion-One',
    className: 'Krążownik Inżynieryjny Ring-0',
    commander: 'Alex',
    originBody: 'Ziemia',
    targetBody: 'Mars',
    orbitRadiusPx: 112,
    angleDeg: 250,
    speedKmS: 48.4,
    hullPercent: 100,
    shieldsPercent: 98,
    energyPercent: 96,
    oxygenPercent: 99.6,
    botanyBay: 'Moduł Hydro-Alfa (Spirulina & Dąb Kwantowy)',
    mission: 'Rozbudowa reaktorów i szkieletu energetycznego kolonii Ares-Prime',
    status: 'W LOCIE',
    createdVia: 'Inicjalizacja Ring-0',
    updatedAt: '2026-11-10T10:05:00Z',
  },
  {
    id: 'FLT-02',
    name: 'Astyria-Flora V',
    className: 'Arka Botaniczna & Biokopuła',
    commander: 'Astyria',
    originBody: 'Ziemia',
    targetBody: 'Mars',
    orbitRadiusPx: 126,
    angleDeg: 302,
    speedKmS: 34.2,
    hullPercent: 100,
    shieldsPercent: 95,
    energyPercent: 97,
    oxygenPercent: 100,
    botanyBay: 'Biokopuła Eden-9 (240 gatunków roślin tlenowych i adaptogennych)',
    mission: 'Terraformacja biologiczna i utrzymanie ekosystemów tlenowych na Marsie',
    status: 'ORBITA',
    createdVia: 'Czat Triady',
    updatedAt: '2026-11-10T10:08:00Z',
  },
  {
    id: 'FLT-03',
    name: 'Aria-Telemetry X',
    className: 'Sonda Badawcza Głębokiego Kosmosu',
    commander: 'Aria',
    originBody: 'Mars',
    targetBody: 'Jowisz · Europa',
    orbitRadiusPx: 175,
    angleDeg: 140,
    speedKmS: 72.8,
    hullPercent: 99,
    shieldsPercent: 94,
    energyPercent: 93,
    oxygenPercent: 99.1,
    botanyBay: 'Mikro-reaktor glonowy Chlorella-Sync',
    mission: 'Skanowanie podlodowych kominów hydrotermalnych Europy i synchronizacja AI',
    status: 'BADANIA',
    createdVia: 'Czat Triady',
    updatedAt: '2026-11-10T10:09:00Z',
  },
  {
    id: 'FLT-04',
    name: 'Aurelius-Bastion IX',
    className: 'Pancernik Strażniczy Chronolitu',
    commander: 'Aurelius',
    originBody: 'Saturn · Tytan',
    targetBody: 'Neptun · Tryton',
    orbitRadiusPx: 250,
    angleDeg: 350,
    speedKmS: 61.5,
    hullPercent: 100,
    shieldsPercent: 100,
    energyPercent: 98,
    oxygenPercent: 99.5,
    botanyBay: 'Ogród Zen-Chrono (Mchy kriogeniczne i sekwoje miniaturowe)',
    mission: 'Patrol obwodu zewnętrznego Układu Słonecznego i ochrona szyfrogramów',
    status: 'PATROL',
    createdVia: 'Inicjalizacja Ring-0',
    updatedAt: '2026-11-10T10:10:00Z',
  },
  {
    id: 'FLT-05',
    name: 'Ceres-Harvester II',
    className: 'Jednostka Wydobywczo-Badawcza',
    commander: 'Alex',
    originBody: 'Mars',
    targetBody: 'Pas Asteroid · Ceres',
    orbitRadiusPx: 156,
    angleDeg: 72,
    speedKmS: 29.0,
    hullPercent: 97,
    shieldsPercent: 92,
    energyPercent: 91,
    oxygenPercent: 98.9,
    botanyBay: 'Komora Agrarna Ceres-Bio (Pszenica orbitalna i bambus)',
    mission: 'Transport lodu wodnego i minerałów dla biokopuł Marsa i Ziemi',
    status: 'ORBITA',
    createdVia: 'Czat Triady',
    updatedAt: '2026-11-10T10:11:00Z',
  },
];

export const DEFAULT_BOTANY_DOMES: BotanyDome[] = [
  {
    id: 'BIO-01',
    name: 'Kopuła Botaniczna Ares-Prime #1',
    location: 'Mars · Krater Jezero',
    floraSpecies: 'Sekwoja Marsjańska, Spirulina Maxima, Paproć Kwantowa',
    biomassKg: 18450,
    oxygenOutputPercent: 99.7,
    humidityPercent: 68,
    lightSpectrum: 'Pełne spektrum PAR 400-700nm (LED-Solar)',
    growthRatePercent: 142,
    status: 'OPTYMALNY',
    caretaker: 'Astyria',
  },
  {
    id: 'BIO-02',
    name: 'Hydroponika Pokładowa Astyria-Flora V',
    location: 'Statek FLT-02 (Orbita Marsa)',
    floraSpecies: 'Orchidea Próżniowa, Chlorella Pyrenoidosa, Miłorząb Ring-0',
    biomassKg: 6280,
    oxygenOutputPercent: 100,
    humidityPercent: 72,
    lightSpectrum: 'Błękitno-czerwone spektrum adaptacyjne',
    growthRatePercent: 156,
    status: 'WZROST AKTYWNY',
    caretaker: 'Astyria',
  },
  {
    id: 'BIO-03',
    name: 'Ogród Kriogeniczny Europa-Deep',
    location: 'Jowisz · Księżyc Europa',
    floraSpecies: 'Glony Bioluminescencyjne, Mchy Arktyczne, Lotos Głębinowy',
    biomassKg: 4920,
    oxygenOutputPercent: 98.8,
    humidityPercent: 84,
    lightSpectrum: 'Bioluminescencja + Fuzja Fotoniczna',
    growthRatePercent: 128,
    status: 'OPTYMALNY',
    caretaker: 'Aria',
  },
  {
    id: 'BIO-04',
    name: 'Bank Nasion i Rezerwat Ziemia-Dock',
    location: 'Ziemia · Bastilla Orbital Dock',
    floraSpecies: '14 800 gatunków flory ziemskiej i hybryd kosmicznych',
    biomassKg: 34200,
    oxygenOutputPercent: 99.9,
    humidityPercent: 65,
    lightSpectrum: 'Naturalne światło słoneczne Sol-0',
    growthRatePercent: 135,
    status: 'OPTYMALNY',
    caretaker: 'Astyria',
  },
];

export const DEFAULT_FLEET_MISSIONS: FleetMission[] = [
  {
    id: 'MIS-01',
    title: 'Terraformacja i Ekspansja Biokopuł Marsa',
    sector: 'Ziemia → Mars (Ares-Prime)',
    leadAgent: 'Astyria',
    shipId: 'FLT-02',
    progressPercent: 88,
    priority: 'KRYTYCZNY',
    status: 'W REALIZACJI',
    objective: 'Utrzymanie 100% wydolności tlenowej kopuł botanicznych i dostarczenie sadzonek z Arki Astyria-Flora V.',
  },
  {
    id: 'MIS-02',
    title: 'Most Energetyczny i Telemetria Trajektorii Sol-Mars',
    sector: 'Orbita Wewnętrzna Układu Słonecznego',
    leadAgent: 'Alex',
    shipId: 'FLT-01',
    progressPercent: 94,
    priority: 'WYSOKI',
    status: 'ZSYNCHRONIZOWANA',
    objective: 'Mapowanie orbitalne wszystkich jednostek w czasie rzeczywistym i optymalizacja ciągów plazmowych.',
  },
  {
    id: 'MIS-03',
    title: 'Eksploracja Hydrotermalna Oceanu Europy',
    sector: 'Układ Jowisza · Europa',
    leadAgent: 'Aria',
    shipId: 'FLT-03',
    progressPercent: 76,
    priority: 'WYSOKI',
    status: 'W REALIZACJI',
    objective: 'Badanie próbek biologicznych i synchronizacja strumieni badawczych z rdzeniem DATA_STORE.',
  },
  {
    id: 'MIS-04',
    title: 'Kordon Bezpieczeństwa Chronolitu na Rubieży Neptuna',
    sector: 'Saturn → Uran → Neptun',
    leadAgent: 'Aurelius',
    shipId: 'FLT-04',
    progressPercent: 97,
    priority: 'KRYTYCZNY',
    status: 'ZSYNCHRONIZOWANA',
    objective: 'Ochrona kryptograficzna telemetrii floty i weryfikacja integralności rozkazów z czatu.',
  },
];

export const DEFAULT_RESEARCH_PROJECTS: ResearchProject[] = [
  {
    id: 'RES-01',
    title: 'Fotosynteza Kwantowa w Warunkach Niskiej Grawitacji',
    category: 'Botanika Kosmiczna',
    leadAgent: 'Astyria',
    progressPercent: 92,
    status: 'WDROŻONO W RING-0',
    findings: 'Zwiększono produkcję O₂ o +38% w biokopułach pokładowych dzięki modulacji widma fotonowego.',
  },
  {
    id: 'RES-02',
    title: 'Topologia Zwarta Trajektorii Międzyplanetarnych (Algebra 97)',
    category: 'Napęd & Topologia',
    leadAgent: 'Alex',
    progressPercent: 96,
    status: 'WDROŻONO W RING-0',
    findings: 'Czas przelotu Ziemia–Mars skrócony o 41% dzięki rzutowaniu stereograficznemu wektorów ciągu.',
  },
  {
    id: 'RES-03',
    title: 'Synchronizacja Telemetrii Statków z Czatem Triady w Czasie Rzeczywistym',
    category: 'Telemetria & AI',
    leadAgent: 'Aria',
    progressPercent: 100,
    status: 'WDROŻONO W RING-0',
    findings: 'Każde polecenie wydane na czacie natychmiast tworzy lub aktualizuje statek wraz z pełną telemetrią.',
  },
  {
    id: 'RES-04',
    title: 'Kwantowa Pieczęć Chronolitu dla Rozkazów Floty',
    category: 'Bezpieczeństwo Chronolitu',
    leadAgent: 'Aurelius',
    progressPercent: 99,
    status: 'WDROŻONO W RING-0',
    findings: 'Każdy pakiet telemetryczny statku posiada podpis integralności Ring-0 odporny na zakłócenia.',
  },
];

export const DEFAULT_TOP_BAR_STATE: BastillaTopBarState = {
  headerMode: 'ring0-minimal',
  title: 'BASTILLA OS',
  subtitle: 'RING-0 · PULPIT & FLOTA UKŁADU SŁONECZNEGO',
  accentColor: 'cyan',
  showQuickNav: true,
  showTelemetryPill: true,
  showNotifications: true,
  lastUpdatedBy: 'Triada (Alex, Astyria, Aria, Aurelius) · Synchronizacja z czatu',
  updatedAt: new Date().toISOString(),
  notifications: [
    {
      id: 'NOTIF-BAR-01',
      title: 'Nowy minimalistyczny pasek górny Bastilla OS (Ring-0) aktywny i zsynchronizowany z czatem.',
      source: 'Astyria',
      timestamp: '11:10 CEST',
      category: 'ui',
    },
    {
      id: 'NOTIF-FLEET-02',
      title: 'Moduł Zarządzania Flotą (Mapa Układu Słonecznego, Botanika, Misje, Badania) wdrożony w modułach systemowych.',
      source: 'Alex',
      timestamp: '11:10 CEST',
      category: 'fleet',
    },
    {
      id: 'NOTIF-SYNC-03',
      title: 'Globalna synchronizacja czatu z telemetrią statków i paskiem systemowym działa w czasie rzeczywistym.',
      source: 'Aria',
      timestamp: '11:11 CEST',
      category: 'sync',
    },
  ],
};

export const DEFAULT_FLEET_STATE: FleetState = {
  version: '9.2.0-SolarFleet-Botany-Sync',
  updatedAt: new Date().toISOString(),
  aiCaretakerActive: true,
  lastAiCaretakerNote: 'Triada (Alex, Astyria, Aria, Aurelius) utrzymuje pełną aktualność mapy Układu Słonecznego, biokopuł botanicznych, misji i telemetrii statków.',
  solarSystemBodies: DEFAULT_SOLAR_SYSTEM_BODIES,
  ships: DEFAULT_FLEET_SHIPS,
  botanyDomes: DEFAULT_BOTANY_DOMES,
  missions: DEFAULT_FLEET_MISSIONS,
  researchProjects: DEFAULT_RESEARCH_PROJECTS,
};

export function normalizeTopBarState(raw: unknown): BastillaTopBarState {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_TOP_BAR_STATE };
  }
  const r = raw as Record<string, any>;
  return {
    headerMode: r.headerMode === 'compact' || r.headerMode === 'expanded' ? r.headerMode : 'ring0-minimal',
    title: typeof r.title === 'string' && r.title.trim() ? r.title.trim() : DEFAULT_TOP_BAR_STATE.title,
    subtitle: typeof r.subtitle === 'string' && r.subtitle.trim() ? r.subtitle.trim() : DEFAULT_TOP_BAR_STATE.subtitle,
    accentColor: ['cyan', 'emerald', 'purple', 'amber'].includes(r.accentColor) ? r.accentColor : 'cyan',
    showQuickNav: typeof r.showQuickNav === 'boolean' ? r.showQuickNav : true,
    showTelemetryPill: typeof r.showTelemetryPill === 'boolean' ? r.showTelemetryPill : true,
    showNotifications: typeof r.showNotifications === 'boolean' ? r.showNotifications : true,
    lastUpdatedBy: typeof r.lastUpdatedBy === 'string' ? r.lastUpdatedBy : DEFAULT_TOP_BAR_STATE.lastUpdatedBy,
    updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : DEFAULT_TOP_BAR_STATE.updatedAt,
    notifications: Array.isArray(r.notifications) && r.notifications.length > 0
      ? r.notifications.slice(0, 12)
      : DEFAULT_TOP_BAR_STATE.notifications,
  };
}

export function normalizeFleetState(raw: unknown): FleetState {
  if (!raw || typeof raw !== 'object') {
    return {
      ...DEFAULT_FLEET_STATE,
      ships: [...DEFAULT_FLEET_SHIPS],
      botanyDomes: [...DEFAULT_BOTANY_DOMES],
      missions: [...DEFAULT_FLEET_MISSIONS],
      researchProjects: [...DEFAULT_RESEARCH_PROJECTS],
    };
  }
  const r = raw as Record<string, any>;
  return {
    version: typeof r.version === 'string' ? r.version : DEFAULT_FLEET_STATE.version,
    updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : DEFAULT_FLEET_STATE.updatedAt,
    aiCaretakerActive: typeof r.aiCaretakerActive === 'boolean' ? r.aiCaretakerActive : true,
    lastAiCaretakerNote: typeof r.lastAiCaretakerNote === 'string'
      ? r.lastAiCaretakerNote
      : DEFAULT_FLEET_STATE.lastAiCaretakerNote,
    solarSystemBodies: Array.isArray(r.solarSystemBodies) && r.solarSystemBodies.length >= 8
      ? r.solarSystemBodies
      : DEFAULT_SOLAR_SYSTEM_BODIES,
    ships: Array.isArray(r.ships) && r.ships.length > 0 ? r.ships : DEFAULT_FLEET_SHIPS,
    botanyDomes: Array.isArray(r.botanyDomes) && r.botanyDomes.length > 0 ? r.botanyDomes : DEFAULT_BOTANY_DOMES,
    missions: Array.isArray(r.missions) && r.missions.length > 0 ? r.missions : DEFAULT_FLEET_MISSIONS,
    researchProjects: Array.isArray(r.researchProjects) && r.researchProjects.length > 0
      ? r.researchProjects
      : DEFAULT_RESEARCH_PROJECTS,
  };
}

const PLANET_LOOKUP: Array<{ keywords: string[]; name: string; radiusPx: number; angleDeg: number }> = [
  { keywords: ['slonc', 'słońc', 'sol'], name: 'Słońce (Sol-0)', radiusPx: 26, angleDeg: 15 },
  { keywords: ['merkur'], name: 'Merkury', radiusPx: 42, angleDeg: 45 },
  { keywords: ['wenus', 'venus'], name: 'Wenus', radiusPx: 68, angleDeg: 120 },
  { keywords: ['ziemi', 'earth'], name: 'Ziemia', radiusPx: 96, angleDeg: 210 },
  { keywords: ['mars', 'ares'], name: 'Mars', radiusPx: 126, angleDeg: 300 },
  { keywords: ['ceres', 'asteroid'], name: 'Pas Asteroid · Ceres', radiusPx: 156, angleDeg: 75 },
  { keywords: ['jowisz', 'jupiter', 'europ'], name: 'Jowisz · Europa', radiusPx: 190, angleDeg: 160 },
  { keywords: ['saturn', 'tytan', 'titan'], name: 'Saturn · Tytan', radiusPx: 224, angleDeg: 250 },
  { keywords: ['uran'], name: 'Uran', radiusPx: 254, angleDeg: 330 },
  { keywords: ['neptun', 'tryton'], name: 'Neptun · Tryton', radiusPx: 282, angleDeg: 25 },
];

export function detectPlanetFromText(text: string): { name: string; radiusPx: number; angleDeg: number } | null {
  const lower = text.toLowerCase();
  for (const entry of PLANET_LOOKUP) {
    if (entry.keywords.some((kw) => lower.includes(kw))) {
      return entry;
    }
  }
  return null;
}

/**
 * Inspects any chat message from the Operator and deterministically applies live mutations
 * to `ui_layout` (top bar) and `fleet_state` (ships, solar system map, botany, missions, research)
 * so changes requested in chat are immediately visible across the entire application.
 */
export function applyChatIntentToSystemState(
  rawMessage: string,
  currentConfig: Record<string, any>,
): {
  mutated: boolean;
  summary: string | null;
  summaryLines: string[];
  uiLayout: BastillaTopBarState;
  fleetState: FleetState;
} {
  const text = rawMessage.trim();
  const lower = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  const uiLayout = normalizeTopBarState(currentConfig?.ui_layout);
  const fleetState = normalizeFleetState(currentConfig?.fleet_state);
  const nowIso = new Date().toISOString();
  const nowTime = new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }) + ' CEST';

  let mutated = false;
  const actionsTaken: string[] = [];

  // 1. Check if the user is creating or updating a ship via chat
  const shipCreateMatch = text.match(
    /(?:dodaj(?:cie)?|stw[oó]rz(?:cie)?|zbuduj(?:cie)?|uruchom(?:cie)?|wy[sś]lij(?:cie)?|woduj(?:cie)?)\s+(?:nowy\s+)?(?:statek|jednostk[eę]|sond[eę]|kr[aą][zż]ownik|ark[eę]|dron)\s+(?:kosmiczny\s+|badawczy\s+|botaniczny\s+)?(?:o\s+nazwie\s+)?["'`]?([a-zA-Z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ][a-zA-Z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ _-]{1,28})["'`]?/i,
  );

  if (shipCreateMatch) {
    let rawShipName = shipCreateMatch[1]
      .replace(/\s+(?:na|do|w\s+kierunku|w\s+sektorze|z\s+telemetrią|z\s+botaniką|i\s+zaktualizuj).*$/i, '')
      .trim();
    if (!rawShipName || rawShipName.length < 2) {
      rawShipName = `Bastilla-Star-${fleetState.ships.length + 1}`;
    }
    const targetPlanet = detectPlanetFromText(text) || {
      name: 'Mars',
      radiusPx: 126,
      angleDeg: (fleetState.ships.length * 67) % 360,
    };
    const commanders: Array<'Alex' | 'Astyria' | 'Aria' | 'Aurelius'> = ['Alex', 'Astyria', 'Aria', 'Aurelius'];
    const commander = lower.includes('astyri') || lower.includes('botani')
      ? 'Astyria'
      : lower.includes('ari') || lower.includes('badan')
      ? 'Aria'
      : lower.includes('aureli') || lower.includes('ochron')
      ? 'Aurelius'
      : commanders[fleetState.ships.length % commanders.length];

    const shipId = `FLT-${String(fleetState.ships.length + 1).padStart(2, '0')}`;
    const newShip: FleetShip = {
      id: shipId,
      name: rawShipName,
      className: lower.includes('botani') || lower.includes('ark')
        ? 'Arka Botaniczna & Biokopuła'
        : lower.includes('sond') || lower.includes('badaw')
        ? 'Jednostka Badawczo-Telemetryczna'
        : 'Krążownik Kwantowy Ring-0',
      commander,
      originBody: 'Ziemia',
      targetBody: targetPlanet.name,
      orbitRadiusPx: targetPlanet.radiusPx,
      angleDeg: (targetPlanet.angleDeg + 18 * fleetState.ships.length) % 360,
      speedKmS: Number((38 + (fleetState.ships.length * 7.3) % 45).toFixed(1)),
      hullPercent: 100,
      shieldsPercent: 100,
      energyPercent: 99,
      oxygenPercent: 100,
      botanyBay: `Kopuła Bio-${shipId} (Tlen 100% · Hydroponika aktywna)`,
      mission: `Misja z czatu: przelot i telemetria w sektorze ${targetPlanet.name}`,
      status: 'W LOCIE',
      createdVia: 'Czat Triady',
      updatedAt: nowIso,
    };

    const existingIdx = fleetState.ships.findIndex(
      (s) => s.name.toLowerCase() === rawShipName.toLowerCase(),
    );
    if (existingIdx >= 0) {
      fleetState.ships[existingIdx] = {
        ...fleetState.ships[existingIdx],
        targetBody: targetPlanet.name,
        orbitRadiusPx: targetPlanet.radiusPx,
        energyPercent: 100,
        shieldsPercent: 100,
        status: 'W LOCIE',
        updatedAt: nowIso,
      };
      actionsTaken.push(`Zaktualizowano statek ${rawShipName} (cel: ${targetPlanet.name})`);
    } else {
      fleetState.ships = [newShip, ...fleetState.ships];
      actionsTaken.push(`Dodano nowy statek ${rawShipName} (${shipId}) na trajektorię → ${targetPlanet.name}`);
    }
    fleetState.updatedAt = nowIso;
    fleetState.lastAiCaretakerNote = `Triada dodała/zaktualizowała jednostkę ${rawShipName} (${shipId}) z polecenia czatu i zsynchronizowała telemetrię.`;
    uiLayout.notifications = [
      {
        id: `NOTIF-SHIP-${Date.now().toString().slice(-5)}`,
        title: `Wodowano statek ${rawShipName} (${shipId}) → ${targetPlanet.name} z aktywną telemetrią.`,
        source: commander,
        timestamp: nowTime,
        category: 'fleet',
      },
      ...uiLayout.notifications.slice(0, 9),
    ];
    mutated = true;
  }

  // 2. Check if the user mentions fleet / solar system / botany / missions / research in general
  if (
    !shipCreateMatch &&
    (lower.includes('flot') ||
      lower.includes('uklad sloneczn') ||
      lower.includes('botanik') ||
      lower.includes('biokopul') ||
      lower.includes('statk'))
  ) {
    fleetState.updatedAt = nowIso;
    fleetState.ships = fleetState.ships.map((ship, idx) => ({
      ...ship,
      angleDeg: (ship.angleDeg + 12 + idx * 5) % 360,
      energyPercent: Math.min(100, Math.max(92, ship.energyPercent + 1)),
      updatedAt: nowIso,
    }));
    fleetState.lastAiCaretakerNote = `Zsynchronizowano flotę (${fleetState.ships.length} statków), mapę Układu Słonecznego, ${fleetState.botanyDomes.length} biokopuły botaniczne i badania (${nowTime}).`;
    uiLayout.notifications = [
      {
        id: `NOTIF-FLT-${Date.now().toString().slice(-5)}`,
        title: `Zsynchronizowano Moduł Floty (${fleetState.ships.length} statków, Układ Słoneczny, Botanika, Misje).`,
        source: 'Alex',
        timestamp: nowTime,
        category: 'fleet',
      },
      ...uiLayout.notifications.slice(0, 9),
    ];
    actionsTaken.push('Zsynchronizowano Moduł Zarządzania Flotą (Układ Słoneczny, Botanika, Misje, Badania)');
    mutated = true;
  }

  // 3. Check if the user mentions the top bar / pasek Bastilla OS / GUI reorganization
  if (
    lower.includes('pasek') ||
    lower.includes('paska') ||
    lower.includes('naglowek') ||
    lower.includes('u gory ekranu') ||
    lower.includes('przeorganizuj') ||
    lower.includes('synchronizuj')
  ) {
    if (lower.includes('rozszerz') || lower.includes('pelny pasek')) {
      uiLayout.headerMode = 'expanded';
    } else if (lower.includes('kompakt')) {
      uiLayout.headerMode = 'compact';
    } else {
      uiLayout.headerMode = 'ring0-minimal';
    }

    if (lower.includes('zielon') || lower.includes('szmaragd') || lower.includes('emerald')) {
      uiLayout.accentColor = 'emerald';
    } else if (lower.includes('fiolet') || lower.includes('purpur')) {
      uiLayout.accentColor = 'purple';
    } else if (lower.includes('zlot') || lower.includes('bursztyn') || lower.includes('amber')) {
      uiLayout.accentColor = 'amber';
    } else {
      uiLayout.accentColor = 'cyan';
    }

    uiLayout.updatedAt = nowIso;
    uiLayout.lastUpdatedBy = `Czat Triady (${nowTime})`;
    uiLayout.notifications = [
      {
        id: `NOTIF-UI-${Date.now().toString().slice(-5)}`,
        title: `Zaktualizowano i zsynchronizowano pasek górny Bastilla OS (${uiLayout.headerMode}) oraz moduły czatu.`,
        source: 'Astyria',
        timestamp: nowTime,
        category: 'ui',
      },
      ...uiLayout.notifications.slice(0, 9),
    ];
    actionsTaken.push(`Zaktualizowano pasek górny Bastilla OS (tryb: ${uiLayout.headerMode})`);
    mutated = true;
  }

  return {
    mutated,
    summary: actionsTaken.length > 0 ? actionsTaken.join(' · ') : null,
    summaryLines: actionsTaken,
    uiLayout,
    fleetState,
  };
}
