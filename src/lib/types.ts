
export type WindDirection = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

export type UserRole = 'client' | 'professional' | 'admin';

export interface UserAccount {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  businessId?: string;
  vesselNickname?: string;
  subscriptionStatus: 'active' | 'inactive' | 'trial' | 'admin' | 'professional';
  subscriptionExpiryDate?: string;
  lastSelectedLocation?: string;
  favoriteCategory?: 'Pêche' | 'Chasse' | 'Jardinage';
  notificationsEnabled?: boolean;
  mapIcon?: string;
  mapColor?: string;
  vesselPrefs?: any;
  subscriptionStartDate?: string;
  cgvAcceptedAt?: string;
  cgvVersionSeen?: number;
  savedVesselIds?: string[];
  lastVesselId?: string;
  isEmergencyEnabled?: boolean;
  isCustomMessageEnabled?: boolean;
  emergencyContact?: string;
  vesselSmsMessage?: string;
}

export interface Business {
  id: string;
  ownerId: string;
  name: string;
  commune: string;
  categories: string[];
  logoUrl?: string;
  description?: string;
  createdAt: any;
}

export interface Promotion {
  id: string;
  businessId: string;
  title: string;
  category?: string;
  description?: string;
  price: number;
  originalPrice?: number | null;
  discountPercentage?: number | null;
  promoType: 'Promo' | 'Nouvel Arrivage';
  imageUrl?: string;
  createdAt: any;
}

export interface Campaign {
  id: string;
  ownerId: string;
  businessId: string;
  businessName: string;
  title: string;
  message: string;
  targetCommune: string;
  targetCategory: string;
  reach: number;
  cost: number;
  status: 'pending' | 'sent';
  createdAt: any;
}

export interface WindForecast {
  time: string;
  speed: number;
  speedLagon: number;
  speedLarge: number;
  speedLand: number;
  direction: WindDirection;
  stability: 'Stable' | 'Tournant';
}

export interface SwellForecast {
  time: string;
  inside: string;
  outside: string;
  period: number;
}

export interface HourlyForecast {
  date: string;
  condition:
    | 'Peu nuageux'
    | 'Ensoleillé'
    | 'Nuageux'
    | 'Averses'
    | 'Pluvieux'
    | 'Nuit claire';
  windSpeed: number;
  windDirection: WindDirection;
  stability: 'Stable' | 'Tournant';
  isNight: boolean;
  temp: number;
  uvIndex: number;
  tideHeight: number;
  tideCurrent: 'Nul' | 'Faible' | 'Modéré' | 'Fort';
  tidePeakType?: 'haute' | 'basse';
}

export interface WeatherData {
  wind: WindForecast[];
  swell: SwellForecast[];
  sun: { sunrise: string; sunset: string; };
  moon: { moonrise: string; moonset: string; phase: string; percentage: number; };
  rain: 'Aucune' | 'Fine' | 'Forte';
  trend: 'Ensoleillé' | 'Nuageux' | 'Averses' | 'Pluvieux';
  uvIndex: number;
  temp: number;
  tempMin: number;
  tempMax: number;
  waterTemperature: number;
  hourly: HourlyForecast[];
}

export interface Tide {
  type: 'haute' | 'basse';
  time: string;
  height: number;
  current: string;
}

export interface FarmingData {
  lunarPhase: 'Lune Montante' | 'Lune Descendante';
  zodiac: 'Fruits' | 'Fleurs' | 'Racines' | 'Feuilles';
  recommendation: string;
  details: {
    task: string;
    description: string;
    icon: 'Spade' | 'Scissors' | 'Flower' | 'Carrot' | 'Leaf' | 'RefreshCw';
  }[];
  isGoodForCuttings: boolean;
  isGoodForPruning: boolean;
  isGoodForMowing: boolean;
  sow: string[];
  harvest: string[];
}

export interface FishRating {
  name: string;
  rating: number;
  location?: 'Lagon' | 'Large' | 'Mixte';
  advice: {
    activity: string;
    feeding: string;
    location_specific: string;
    depth: string;
  };
}

export interface FishingSlot {
  timeOfDay: string;
  tide: string;
  tideTime: string;
  tideMovement: 'montante' | 'descendante' | 'étale';
  fish: FishRating[];
}

export interface HuntingData {
  period: { name: 'Brame' | 'Chute des bois' | 'Normal'; description: string; };
  advice: { rain: string; scent: string; };
}

export interface LocationData {
  weather: WeatherData;
  tides: Tide[];
  farming: FarmingData;
  fishing: FishingSlot[];
  hunting: HuntingData;
  pelagicInfo?: { inSeason: boolean; message: string; };
  crabAndLobster: {
    crabStatus: 'Plein' | 'Mout' | 'Vide';
    crabMessage: string;
    lobsterActivity: 'Élevée' | 'Moyenne' | 'Faible';
    lobsterMessage: string;
    octopusActivity: 'Élevée' | 'Moyenne' | 'Faible' | null;
    octopusMessage: string;
  };
  tideStation: string;
  tideThresholds: { high: number; low: number; };
}

export interface SafetyItem {
  id: string;
  type: 'fusée' | 'extincteur' | 'autre';
  label: string;
  expiryDate: string;
}

export interface UserVesselSafety {
  id: string;
  userId: string;
  vesselName: string;
  equipment: SafetyItem[];
  createdAt: any;
}

export interface FishSpeciesInfo {
  id: string;
  name: string;
  scientificName: string;
  gratteRisk: number;
  gratteRiskSmall: number;
  gratteRiskMedium: number;
  gratteRiskLarge: number;
  lengthSmall?: string;
  lengthMedium?: string;
  lengthLarge?: string;
  culinaryAdvice: string;
  fishingAdvice: string;
  category: 'Lagon' | 'Large' | 'Recif';
  imageUrl?: string;
  imagePlaceholder?: string;
}

export interface FishCommuneStats {
  id: string;
  somme_des_notes: number;
  nombre_de_votants: number;
  moyenne_calculee: number;
  dernier_update: any;
  small_sum?: number;
  small_count?: number;
  medium_sum?: number;
  medium_count?: number;
  large_sum?: number;
  large_count?: number;
}

export interface FaqEntry {
  id: string;
  question: string;
  reponse: string;
  categorie: 'General' | 'Peche' | 'Boat Tracker' | 'Chasse' | 'Champs' | 'Compte';
  ordre: number;
  views?: number;
}

export interface SupportTicket {
  id: string;
  userId: string;
  userEmail: string;
  sujet: string;
  description: string;
  statut: 'ouvert' | 'ferme';
  createdAt: any;
  captureUrl?: string;
  adminResponse?: string;
  respondedAt?: any;
}

export interface GardenPlant {
  id: string;
  userId: string;
  name: string;
  category: 'Arbre Fruitier' | 'Potager' | 'Fleur' | 'Aromatique' | 'Autre';
  createdAt: any;
}

export interface FishingSpot {
  id: string;
  userId: string;
  name: string;
  notes?: string;
  location: { latitude: number; longitude: number; };
  icon: string;
  color: string;
  fishingTypes?: string[];
  createdAt: any;
  context: any;
  sharedBy?: string;
}

export interface HuntingMarker {
  id: string;
  lat: number;
  lng: number;
  time: string;
}

export interface VesselStatus {
  id: string;
  userId: string;
  displayName: string;
  location: { latitude: number; longitude: number; } | null;
  status: 'moving' | 'stationary' | 'offline' | 'returning' | 'landed' | 'emergency';
  lastActive: any;
  isSharing: boolean;
  batteryLevel?: number;
  isCharging?: boolean;
  statusChangedAt?: any;
  eventLabel?: string;
  historyClearedAt?: any;
  huntingMarkers?: HuntingMarker[];
  isPositionHidden?: boolean;
}

export interface SoundLibraryEntry {
  id: string;
  label: string;
  url: string;
  categories: string[];
}

export interface SplashScreenSettings {
  splashMode: 'text' | 'image';
  splashText?: string;
  splashTextColor?: string;
  splashFontSize?: string;
  splashBgColor?: string;
  splashImageUrl?: string;
  splashImageFit?: 'cover' | 'contain';
  splashDuration?: number;
}

export interface MeteoLive {
  id: string;
  vent: number;
  temperature: number;
  uv: number;
  direction?: WindDirection;
  direction_vent?: number;
}

export interface MeteoForecast {
  id: string;
  code_meteo: number;
  date: string;
  temp_max: number;
  temp_min: number;
  vent_max: number;
}

export interface CgvSettings {
  content: string;
  updatedAt: any;
  version: number;
}

export interface RibSettings {
  details: string;
  updatedAt: any;
}

export interface CgvAcceptance {
  id: string;
  userId: string;
  acceptedAt: any;
  version: number;
  content: string;
}

export interface SpotShare {
  id: string;
  senderId: string;
  senderName: string;
  recipientEmail: string;
  spotData: any;
  createdAt: any;
}

export interface AccessToken {
  id: string;
  status: 'active' | 'redeemed';
  durationMonths: number;
  createdAt: any;
  redeemedBy?: string;
  redeemedAt?: any;
}

export interface SharedAccessToken {
  id: string;
  expiresAt: any;
  updatedAt: any;
}

export interface SystemNotification {
  id: string;
  title: string;
  content: string;
  type: 'info' | 'warning' | 'error' | 'success';
  isActive: boolean;
  createdAt: any;
}

export interface SessionParticipant {
  id: string;
  displayName: string;
  location?: { latitude: number; longitude: number };
  battery?: { level: number; charging: boolean };
  updatedAt: any;
  mapIcon: string;
  mapColor: string;
  baseStatus?: string;
  isGibierEnVue?: boolean;
}

export interface HuntingSession {
  id: string;
  organizerId: string;
  createdAt: any;
  expiresAt: any;
}
