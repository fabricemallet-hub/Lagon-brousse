
import { LocationData, SwellForecast, Tide, WindDirection, WindForecast, HourlyForecast } from './types';
import { locations } from './locations';
import { Firestore, doc, getDoc, collection, getDocs, limit, orderBy, query } from 'firebase/firestore';

// Data from https://www.meteo.nc/nouvelle-caledonie/mer/previsions-site
const tideStations = {
  'Nouméa': {
    tides: [
      { type: 'haute', time: '07:23', height: 1.57, current: 'Fort' },
      { type: 'basse', time: '13:54', height: 0.35, current: 'Modéré' },
      { type: 'haute', time: '19:40', height: 1.39, current: 'Fort' },
      { type: 'basse', time: '01:31', height: 0.44, current: 'Modéré' },
    ]
  },
  'Bourail': {
    tides: [
      { type: 'haute', time: '08:55', height: 1.62, current: 'Fort' },
      { type: 'basse', time: '15:10', height: 0.59, current: 'Modéré' },
      { type: 'haute', time: '20:40', height: 1.32, current: 'Fort' },
      { type: 'basse', time: '02:05', height: 0.25, current: 'Modéré' },
    ]
  },
  'Koné': {
     tides: [
      { type: 'haute', time: '10:45', height: 1.7, current: 'Fort' },
      { type: 'basse', time: '17:00', height: 0.6, current: 'Modéré' },
      { type: 'haute', time: '23:15', height: 1.6, current: 'Fort' },
      { type: 'basse', time: '04:30', height: 0.5, current: 'Modéré' },
    ]
  },
  'Thio': {
    tides: [
      { type: 'haute', time: '10:20', height: 1.5, current: 'Fort' },
      { type: 'basse', time: '16:35', height: 0.4, current: 'Modéré' },
      { type: 'haute', time: '22:50', height: 1.4, current: 'Fort' },
      { type: 'basse', time: '04:05', height: 0.3, current: 'Modéré' },
    ]
  },
  'Koumac': {
    tides: [
      { type: 'haute', time: '10:30', height: 1.8, current: 'Fort' },
      { type: 'basse', time: '17:15', height: 0.7, current: 'Modéré' },
      { type: 'haute', time: '23:00', height: 1.7, current: 'Fort' },
      { type: 'basse', time: '04:00', height: 0.6, current: 'Modéré' },
    ]
  },
  'Hienghène': {
    tides: [
      { type: 'haute', time: '09:45', height: 1.3, current: 'Fort' },
      { type: 'basse', time: '16:00', height: 0.35, current: 'Modéré' },
      { type: 'haute', time: '21:50', height: 1.25, current: 'Fort' },
      { type: 'basse', time: '03:30', height: 0.4, current: 'Modéré' },
    ]
  },
  'Ouvéa': {
    tides: [
      { type: 'haute', time: '09:10', height: 1.4, current: 'Fort' },
      { type: 'basse', time: '15:30', height: 0.4, current: 'Modéré' },
      { type: 'haute', time: '21:00', height: 1.2, current: 'Fort' },
      { type: 'basse', time: '02:45', height: 0.5, current: 'Modéré' },
    ]
  }
};

export const communeToTideStationMap: { [key: string]: string } = {
  'Bélep': 'Koumac', 'Boulouparis': 'Nouméa', 'Bourail': 'Bourail', 'Canala': 'Thio',
  'Dumbéa': 'Nouméa', 'Farino': 'Bourail', 'Hienghène': 'Hienghène', 'Houaïlou': 'Hienghène',
  "L'Île-des-Pins": 'Nouméa', 'Kaala-Gomen': 'Koumac', 'Koné': 'Koné', 'Kouaoua': 'Thio',
  'Koumac': 'Koumac', 'La Foa': 'Bourail', 'Le Mont-Dore': 'Nouméa', 'Lifou': 'Ouvéa',
  'Maré': 'Ouvéa', 'Moindou': 'Bourail', 'Nouméa': 'Nouméa', 'Ouégoa': 'Koumac',
  'Ouvéa': 'Ouvéa', 'Païta': 'Nouméa', 'Poindimié': 'Hienghène', 'Ponérihouen': 'Hienghène',
  'Pouébo': 'Koumac', 'Pouembout': 'Koné', 'Poum': 'Koumac', 'Poya': 'Koné',
  'Sarraméa': 'Bourail', 'Thio': 'Thio', 'Voh': 'Koné', 'Yaté': 'Nouméa',
};

// Base data for all locations, tides will be added dynamically.
const baseData: Omit<LocationData, 'tides' | 'tideStation'> = {
  weather: {
    wind: [],
    swell: [],
    sun: { sunrise: '06:31', sunset: '17:45' },
    moon: { moonrise: '12:05', moonset: '23:55', phase: 'Premier quartier', percentage: 50 },
    rain: 'Aucune', trend: 'Ensoleillé', uvIndex: 7, temp: 26, tempMin: 23, tempMax: 33, hourly: [],
  },
  farming: {
    lunarPhase: 'Lune Montante', zodiac: 'Feuilles', recommendation: 'Planter des légumes feuilles, bouturer.',
    details: [
      { task: 'Plantation de légumes feuilles', description: 'La sève monte, idéal pour les salades, brèdes et choux.', icon: 'Leaf' },
      { task: 'Bouturage', description: 'Les boutures prennent plus facilement en lune montante.', icon: 'RefreshCw' },
      { task: 'Semis de fleurs', description: 'Profitez de cette phase pour semer vos fleurs annuelles.', icon: 'Flower' },
    ],
    isGoodForCuttings: false, isGoodForPruning: false, isGoodForMowing: false, sow: [], harvest: [],
  },
  fishing: [
    {
      timeOfDay: 'Aube (05:00 - 07:00)', tide: '', tideTime: '', tideMovement: 'étale',
      fish: [
        { name: 'Wahoo', rating: 9, location: 'Large', advice: { activity: 'Très forte activité à l\'aube. Vitesse et agressivité maximales.', feeding: 'Excellente heure de chasse pour les proies rapides.', location_specific: 'Tombants extérieurs, DCP, et zones de courant fort.', depth: 'Surface.' } },
        { name: 'Mahi-mahi', rating: 9, location: 'Large', advice: { activity: 'Très actif, en chasse autour des objets flottants.', feeding: 'Excellente heure, se nourrit de tout ce qui passe à portée.', location_specific: 'Sous les débris, bouées ou nappes d\'algues sargasses.', depth: 'Surface.' } },
        { name: 'Thon Jaune', rating: 9, location: 'Large', advice: { activity: 'Très actif, chasse en surface tôt le matin.', feeding: 'Excellente heure, se nourrit de poissons volants et calamars.', location_specific: 'Au large, chercher les chasses d\'oiseaux.', depth: 'Surface à 30m.' } },
        { name: 'Thazard', rating: 8, location: 'Mixte', advice: { activity: 'Actif, patrouille les bords de récifs.', feeding: 'Bonne heure, chasse les petits poissons près des tombants.', location_specific: 'Passes, tombants récifaux, et près des DCP.', depth: 'Surface à 20m.' } },
        { name: 'Thon dents de chien', rating: 8, location: 'Large', advice: { activity: 'Très actif au lever du jour, prédateur redoutable.', feeding: 'Excellente heure de chasse sur les proies de récif.', location_specific: 'Tombants vertigineux et passes profondes.', depth: '20-60m.' } },
        { name: 'Carangue', rating: 8, location: 'Lagon', advice: { activity: 'Très active, en chasse près de la surface.', feeding: 'Excellente heure, prédateurs affamés.', location_specific: 'Cibler les passes, les tombants et les patates de corail.', depth: 'Surface à 15m.' } },
        { name: 'Bec de cane', rating: 9, location: 'Lagon', advice: { activity: 'En bancs, très actif.', feeding: 'Très bonne heure, se nourrit agressivement.', location_specific: 'Sur les platiers, bords de chenaux.', depth: '2-10m.' } },
        { name: 'Bossu doré', rating: 8, location: 'Lagon', advice: { activity: 'Activité en hausse, se déplace pour chasser.', feeding: 'Excellente heure, mordeur.', location_specific: 'Autour des patates de corail isolées et petits tombants.', depth: '5-20m.' } },
        { name: 'Dawa', rating: 8, location: 'Lagon', advice: { activity: 'Active, chasse à l\'affût près des structures.', feeding: 'Bonne heure, se nourrit de petits poissons et crustacés.', location_specific: 'Patates de corail, petits tombants et zones d\'éboulis.', depth: '5-20m.' } },
        { name: 'Rouget', rating: 7, location: 'Lagon', advice: { activity: 'Actif à l\'aube, commence à fouiller le sable.', feeding: 'Bonne heure, commence à s\'alimenter.', location_specific: 'Fonds sableux et détritiques près des récifs.', depth: '5-15m.' } },
      ],
    },
    {
      timeOfDay: 'Matinée (09:00 - 11:00)', tide: '', tideTime: '', tideMovement: 'étale',
      fish: [
        { name: 'Thon Jaune', rating: 6, location: 'Large', advice: { activity: 'Activité en baisse, peut sonder plus profond.', feeding: 'Moins prévisible, mais toujours à la recherche d\'opportunités.', location_specific: 'Suivre les oiseaux, ou chercher près des DCP.', depth: '20-50m.' } },
        { name: 'Bonite', rating: 7, location: 'Mixte', advice: { activity: 'Très active, chasse en bancs.', feeding: 'Se nourrit frénétiquement si une boule de fourrage est trouvée.', location_specific: 'Souvent en surface, crée des chasses visibles.', depth: 'Surface.' } },
        { name: 'Carangue', rating: 7, location: 'Lagon', advice: { activity: 'Toujours active, mais peut être moins frénétique qu\'à l\'aube.', feeding: 'Bonne heure, reste un prédateur efficace.', location_specific: 'Continue de chasser autour des passes et des patates de corail.', depth: 'Surface à 20m.' } },
        { name: 'Bossu doré', rating: 7, location: 'Lagon', advice: { activity: 'Activité modérée, proche de sa structure.', feeding: 'Bonne heure, reste à l\'affût.', location_specific: 'Proche des patates de corail, reste à l\'ombre de la structure.', depth: '10-25m.' } },
        { name: 'Dawa', rating: 6, location: 'Lagon', advice: { activity: 'Activité modérée, reste à l\'affût près des cailloux.', feeding: 'Heure correcte, peut être opportuniste.', location_specific: 'Alentours des patates de corail et zones ombragées.', depth: '5-20m.' } },
        { name: 'Picot rayé', rating: 8, location: 'Lagon', advice: { activity: 'Actif, broute en groupe sur les platiers.', feeding: 'Heure idéale pour se nourrir d\'algues.', location_specific: 'Platiers coralliens, zones d\'herbiers peu profondes.', depth: '1-4m.' } },
        { name: 'Picot chirurgien', rating: 7, location: 'Lagon', advice: { activity: 'En bancs, broute activement le corail.', feeding: 'Heure de nourrissage intense.', location_specific: 'Hauts des patates de corail, tombants peu profonds.', depth: '1-5m.' } },
      ],
    },
    {
      timeOfDay: 'Après-midi (15:00 - 17:00)', tide: '', tideTime: '', tideMovement: 'étale',
      fish: [
        { name: 'Thazard', rating: 5, location: 'Mixte', advice: { activity: 'Actif, patrouille le long des récifs.', feeding: 'Bonne heure de chasse avant le crépuscule.', location_specific: 'Bords extérieurs du récif, passes.', depth: 'Surface à 20m.' } },
        { name: 'Bonite', rating: 7, location: 'Mixte', advice: { activity: 'Très active, chasse en bancs.', feeding: 'Se nourrit frénétiquement si une boule de fourrage est trouvée.', location_specific: 'Souvent en surface, crée des chasses visibles.', depth: 'Surface.' } },
        { name: 'Carangue', rating: 6, location: 'Lagon', advice: { activity: 'L\'activité reprend à l\'approche du soir.', feeding: 'Bonne heure, commence à se préparer pour la chasse du crépuscule.', location_specific: 'Près des passes et des tombants.', depth: 'Surface à 15m.' } },
        { name: 'Bossu doré', rating: 5, location: 'Lagon', advice: { activity: 'Activité en baisse, plus discret.', feeding: 'Heure moyenne, moins agressif.', location_specific: 'Au plus près des structures, difficile à déloger.', depth: '15-30m.' } },
        { name: 'Picot rayé', rating: 7, location: 'Lagon', advice: { activity: 'Toujours en activité de broutage avant la nuit.', feeding: 'Continue de s\'alimenter activement.', location_specific: 'Sur les platiers et les bords de récifs.', depth: '1-4m.' } },
      ],
    },
    {
      timeOfDay: 'Crépuscule (17:30 - 19:00)', tide: '', tideTime: '', tideMovement: 'étale',
      fish: [
        { name: 'Thon dents de chien', rating: 7, location: 'Large', advice: { activity: 'Prédateur redoutable, très actif à cette heure.', feeding: 'Excellente heure de chasse.', location_specific: 'Tombants vertigineux et passes profondes.', depth: '20-60m.' } },
        { name: 'Carangue', rating: 9, location: 'Lagon', advice: { activity: 'Très forte activité, chasse en meute.', feeding: 'Excellente heure, très agressif sur les chasses.', location_specific: 'Passes, platiers, et autour des bancs de fourrage.', depth: 'Surface à 10m.' } },
        { name: 'Bec de cane', rating: 9, location: 'Lagon', advice: { activity: 'En bancs, activité intense au crépuscule.', feeding: 'Très bonne heure de chasse avant la nuit.', location_specific: 'Sur les platiers, bords de chenaux et près des patates.', depth: '2-10m.' } },
        { name: 'Bossu doré', rating: 8, location: 'Lagon', advice: { activity: 'Très bonne activité, sort pour chasser.', feeding: 'Excellente heure, très agressif.', location_specific: 'Se détache des structures pour chasser sur les fonds sableux environnants.', depth: '5-20m.' } },
        { name: 'Dawa', rating: 9, location: 'Lagon', advice: { activity: 'Très active, pic d\'activité au crépuscule.', feeding: 'Excellente heure, devient un prédateur redoutable.', location_specific: 'Patates de corail, tombants, et zones rocheuses.', depth: '5-20m.' } },
        { name: 'Rouget', rating: 9, location: 'Lagon', advice: { activity: 'Très actif, sort pour se nourrir.', feeding: 'Excellente heure, fouille le sable activement.', location_specific: 'Fonds sableux près des zones rocheuses ou coralliennes.', depth: '5-15m.' } },
        { name: 'Vivaneau', rating: 8, location: 'Lagon', advice: { activity: 'Quitte son abri, devient un prédateur actif.', feeding: 'Très bonne heure, chasse à l\'affût.', location_specific: 'Autour des patates de corail et des tombants.', depth: '10-40m.' } },
      ],
    },
  ],
  hunting: {
    period: { name: 'Normal', description: 'Activité normale des cerfs.' },
    advice: { rain: 'Temps sec, avancez silencieusement.', scent: 'Le vent stable facilite la gestion des odeurs.' }
  },
  crabAndLobster: {
    crabStatus: 'Plein', crabMessage: '', lobsterActivity: 'Moyenne', lobsterMessage: '',
    octopusActivity: 'Moyenne', octopusMessage: ''
  }
};

function getWindDirection(deg: number): WindDirection {
  const directions: WindDirection[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return directions[Math.round(deg / 45) % 8];
}

function mapWeatherCondition(owmId: number, isNight: boolean): HourlyForecast['condition'] {
    if (owmId >= 200 && owmId < 300) return 'Averses'; // Thunderstorm -> Averses
    if (owmId >= 300 && owmId < 600) return 'Pluvieux'; // Drizzle/Rain -> Pluvieux
    if (owmId >= 600 && owmId < 700) return 'Averses'; // Snow -> Averses (NC context)
    if (owmId >= 700 && owmId < 800) return 'Nuageux'; // Atmosphere (Mist, etc) -> Nuageux
    if (owmId === 800) return isNight ? 'Nuit claire' : 'Ensoleillé';
    if (owmId === 801 || owmId === 802) return 'Peu nuageux';
    if (owmId === 803 || owmId === 804) return 'Nuageux';
    return 'Nuageux'; // Default
}

function formatTime(unixTimestamp: number, timezoneOffset: number): string {
    const date = new Date((unixTimestamp + timezoneOffset) * 1000);
    return date.toISOString().substr(11, 5);
}

function calculateHourlyTides(location: string, baseDate: Date): Pick<HourlyForecast, 'date' | 'tideHeight' | 'tideCurrent' | 'tidePeakType'>[] {
    const getTidesForDay = (date: Date): Tide[] => {
        const dayOfMonth = date.getDate();
        const month = date.getMonth();
        const year = date.getFullYear();
        const dateSeed = dayOfMonth + month * 31 + year * 365.25;
        const locationSeed = location.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const tideStation = communeToTideStationMap[location] || 'Nouméa';
        const stationTides = tideStations[tideStation as keyof typeof tideStations] || tideStations['Nouméa'];

        const varyTime = (time: string, offset: number) => {
            let [h, m] = time.split(':').map(Number);
            m += Math.floor(Math.sin(dateSeed * 0.05 + locationSeed + offset) * 15);
            if (m >= 60) { h = (h + 1) % 24; m %= 60; }
            if (m < 0) { h = (h - 1 + 24) % 24; m += 60; }
            return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        }

        const dailyTides: Tide[] = JSON.parse(JSON.stringify(stationTides.tides));
        dailyTides.forEach((tide: Tide, i: number) => {
            const baseTide = stationTides.tides[i % stationTides.tides.length];
            const variation = Math.sin((dateSeed * (1 + i * 0.1) + locationSeed * 0.2)) * (baseTide.height * 0.1);
            tide.height = parseFloat(Math.max(0.1, baseTide.height + variation).toFixed(2));
            tide.time = varyTime(baseTide.time, i + 5);
        });
        return dailyTides;
    }

    const prevDate = new Date(baseDate);
    prevDate.setDate(baseDate.getDate() - 1);
    const nextDate = new Date(baseDate);
    nextDate.setDate(baseDate.getDate() + 1);

    const tidesPrev = getTidesForDay(prevDate);
    const tidesToday = getTidesForDay(baseDate);
    const tidesNext = getTidesForDay(nextDate);

    const timeToMinutes = (timeStr: string) => {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
    };

    const allTideEvents = [
        ...tidesPrev.map(t => ({ ...t, timeMinutes: timeToMinutes(t.time) - 24 * 60 })),
        ...tidesToday.map(t => ({ ...t, timeMinutes: timeToMinutes(t.time) })),
        ...tidesNext.map(t => ({ ...t, timeMinutes: timeToMinutes(t.time) + 24 * 60 })),
    ].sort((a, b) => a.timeMinutes - b.timeMinutes);

    const hourlyTides: Pick<HourlyForecast, 'date' | 'tideHeight' | 'tideCurrent' | 'tidePeakType'>[] = [];
    const startDate = new Date(baseDate);
    startDate.setHours(0, 0, 0, 0);

    for (let i = 0; i < 48; i++) {
        const currentHourDate = new Date(startDate.getTime() + i * 60 * 60 * 1000);
        const totalMinutes = i * 60;

        let nextTideIndex = allTideEvents.findIndex(t => t.timeMinutes > totalMinutes);
        if (nextTideIndex === -1) nextTideIndex = allTideEvents.length - 1;
        let prevTideIndex = nextTideIndex > 0 ? nextTideIndex - 1 : 0;

        const prevTide = allTideEvents[prevTideIndex];
        const nextTide = allTideEvents[nextTideIndex];

        let tideHeight = prevTide.height;
        let tideCurrent: 'Nul' | 'Faible' | 'Modéré' | 'Fort' = 'Nul';
        let tidePeakType: 'haute' | 'basse' | undefined = undefined;

        const tideDuration = nextTide.timeMinutes - prevTide.timeMinutes;

        if (tideDuration > 0) {
            const timeSincePrevTide = totalMinutes - prevTide.timeMinutes;
            const phase = (timeSincePrevTide / tideDuration) * Math.PI;

            const amplitude = (prevTide.height - nextTide.height) / 2;
            const midline = (prevTide.height + nextTide.height) / 2;
            tideHeight = midline + amplitude * Math.cos(phase);

            const maxTideRange = Math.abs(prevTide.height - nextTide.height);
            const strengthValue = Math.abs(Math.sin(phase)) * maxTideRange;
            
            // Check proximity to any peak to set the peak type
            let closestPeak: (typeof allTideEvents[0]) | null = null;
            let minDiff = Infinity;
            allTideEvents.forEach(peak => {
                const diff = Math.abs(peak.timeMinutes - totalMinutes);
                if (diff < minDiff) {
                    minDiff = diff;
                    closestPeak = peak;
                }
            });

            if (minDiff < 45 && closestPeak) { // If within 45 minutes of a peak, flag it as such.
                tidePeakType = closestPeak.type;
            }

            if (strengthValue > 1.0) tideCurrent = 'Fort';
            else if (strengthValue > 0.5) tideCurrent = 'Modéré';
            else if (strengthValue > 0.1) tideCurrent = 'Faible';
            else {
                tideCurrent = 'Nul';
                 // Ensure peak type is set at slack tide
                if (!tidePeakType && closestPeak) {
                   tidePeakType = closestPeak.type
                }
            }
        }

        hourlyTides.push({
            date: currentHourDate.toISOString(),
            tideHeight: tideHeight,
            tideCurrent: tideCurrent,
            tidePeakType: tidePeakType
        });
    }

    return hourlyTides;
}

export function generateProceduralData(location: string, date: Date): LocationData {
  const effectiveDate = date || new Date();
  const dayOfMonth = effectiveDate.getDate();
  const month = effectiveDate.getMonth();
  const year = effectiveDate.getFullYear();

  const locationSeed = location.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const dateSeed = dayOfMonth + month * 31 + year * 365.25;

  const varyTime = (time: string, offset: number) => {
    let [h, m] = time.split(':').map(Number);
    m += Math.floor(Math.sin(dateSeed * 0.05 + locationSeed + offset) * 15);
    if (m >= 60) { h = (h + 1) % 24; m %= 60; }
    if (m < 0) { h = (h - 1 + 24) % 24; m += 60; }
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  }

  // 1. Determine tide station and get base tides
  const tideStation = communeToTideStationMap[location] || 'Nouméa';
  const stationTides = tideStations[tideStation as keyof typeof tideStations] || tideStations['Nouméa'];

  // 2. Create a deep copy of base data and add tides
  const locationData: LocationData = {
      ...JSON.parse(JSON.stringify(baseData)),
      tides: JSON.parse(JSON.stringify(stationTides.tides)),
      tideStation: tideStation
  };

  // Vary tides slightly for realism
  locationData.tides.forEach((tide: Tide, i: number) => {
    const baseTide = stationTides.tides[i % stationTides.tides.length];
    const variation = Math.sin((dateSeed * (1 + i * 0.1) + locationSeed * 0.2)) * (baseTide.height * 0.1); // Smaller variation
    tide.height = parseFloat(Math.max(0.1, baseTide.height + variation).toFixed(2));
    tide.time = varyTime(tide.time, i + 5);
  });
  
  const timeToMinutes = (timeStr: string) => {
      const [hours, minutes] = timeStr.split(':').map(Number);
      return hours * 60 + minutes;
  };

  locationData.fishing.forEach(slot => {
    const slotStartHour = parseInt(slot.timeOfDay.match(/(\d{2}):\d{2}/)![1]);
    const slotStartMinutes = slotStartHour * 60;

    let closestTide: Tide | null = null;
    let minDiff = Infinity;

    locationData.tides.forEach(tide => {
        const tideMinutes = timeToMinutes(tide.time);
        const diff = Math.abs(slotStartMinutes - tideMinutes);

        if (diff < minDiff) {
            minDiff = diff;
            closestTide = tide;
        }
    });

    if (closestTide) {
        slot.tide = `Marée ${closestTide.type}`;
        slot.tideTime = closestTide.time;
        // Determine tide movement based on the *next* tide
        const slotEndMinutes = slotStartMinutes + 120; // 2 hour slot
        let nextTide: Tide | null = null;
        let minNextDiff = Infinity;

        locationData.tides.forEach(tide => {
             const tideMinutes = timeToMinutes(tide.time);
             const diff = tideMinutes - slotEndMinutes;
             if (diff > 0 && diff < minNextDiff) {
                 minNextDiff = diff;
                 nextTide = tide;
             }
        });
        
        // If no next tide found for the day, check from the beginning of next day's tides
        if (!nextTide) {
            let firstTideNextDay: Tide | null = null;
            let minFirstDiff = Infinity;
            locationData.tides.forEach(tide => {
                const tideMinutes = timeToMinutes(tide.time) + 24*60;
                const diff = tideMinutes - slotEndMinutes;
                if(diff > 0 && diff < minFirstDiff){
                    minFirstDiff = diff;
                    firstTideNextDay = tide;
                }
            });
            nextTide = firstTideNextDay;
        }

        if (minDiff < 30) {
            slot.tideMovement = 'étale';
        } else if (nextTide) {
            if (nextTide.type === 'haute') {
                slot.tideMovement = 'montante';
            } else {
                slot.tideMovement = 'descendante';
            }
        } else {
             slot.tideMovement = 'étale';
        }
    }
  });
  
    // Moon phase calculation
  const phases: string[] = ['Nouvelle lune', 'Premier croissant', 'Premier quartier', 'Lune gibbeuse croissante', 'Pleine lune', 'Lune gibbeuse décroissante', 'Dernier quartier', 'Dernier croissant'];
  const knownNewMoon = new Date('2024-01-11T00:00:00Z');
  const daysSinceKnownNewMoon = (effectiveDate.getTime() - knownNewMoon.getTime()) / (1000 * 3600 * 24);
  const dayInCycle = daysSinceKnownNewMoon % 29.53;
  
  const phaseIndex = Math.floor((dayInCycle / 29.53) * 8 + 0.5) % 8;
  locationData.weather.moon.phase = phases[phaseIndex];
  
  const illumination = 0.5 * (1 - Math.cos((dayInCycle / 29.53) * 2 * Math.PI));
  locationData.weather.moon.percentage = Math.round(illumination * 100);

  // Pelagic fish season logic
  const warmSeasonMonths = [8, 9, 10, 11, 0, 1, 2, 3]; // Sep to Apr
  const isPelagicSeason = warmSeasonMonths.includes(month);
  
  locationData.pelagicInfo = {
      inSeason: isPelagicSeason,
      message: isPelagicSeason
          ? 'La saison chaude bat son plein ! C\'est le meilleur moment pour cibler les pélagiques comme le thon, le mahi-mahi et le wahoo au large.'
          : 'Hors saison pour les grands pélagiques. Concentrez-vous sur les espèces de récif et de lagon.'
  };

  // Fishing rating
  locationData.fishing.forEach((slot) => {
    slot.fish.forEach((f) => {
      // Start with a base rating of 2/10 for more variation and stricter scoring.
      let rating = 2;

      // 1. Time of day bonus/penalty is now more pronounced.
      if (slot.timeOfDay.includes('Aube') || slot.timeOfDay.includes('Crépuscule')) {
        rating += 3; // Prime time gets a significant boost.
      } else {
        rating -= 1; // Mid-day is generally less active.
      }

      // 2. Tide movement is critical. Increased penalty for slack tide.
      if (slot.tideMovement !== 'étale') {
        rating += 3; // Moving water is good.
      } else {
        rating -= 5; // Strong penalty for slack tide, as fish are less active.
      }

      // 3. Moon Phase Bonus with stronger penalties.
      // dayInCycle: 0=new, 7.4=1st Q, 14.76=full, 22.1=3rd Q
      const isNearNewOrFullMoon = (dayInCycle < 4 || dayInCycle > 25.5) || (dayInCycle > 10.75 && dayInCycle < 18.75);
      const isNearQuarterMoon = (dayInCycle >= 4 && dayInCycle <= 10.75) || (dayInCycle >= 18.75 && dayInCycle <= 25.5);

      if (isNearNewOrFullMoon) {
        rating += 3; // Strong bonus for new/full moon springs tides.
      } else if (isNearQuarterMoon) {
        rating -= 2; // Stronger penalty for quarter moons (neap tides).
      }

      // 4. Pelagic season bonus with stronger penalties.
      const isPelagic = ['Mahi-mahi', 'Wahoo', 'Thon Jaune', 'Thazard', 'Bonite', 'Thon dents de chien'].includes(f.name);
      if (isPelagic) {
        if (isPelagicSeason) {
          rating += 2;
        } else {
          rating -= 5; // Very strong penalty out of season.
        }
      }

      // 5. Add a smaller, deterministic random factor for variety
      const fishNameSeed = f.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const randomFactor = Math.sin(dateSeed * 0.1 + locationSeed * 0.05 + fishNameSeed * 0.02 + slot.timeOfDay.length); // value between -1 and 1
      rating += randomFactor;

      // Clamp the final rating between 1 and 10
      f.rating = Math.max(1, Math.min(10, Math.round(rating)));
    });
  });

  // Vary Wind
  locationData.weather.wind.forEach((forecast: WindForecast, index: number) => {
    forecast.speed = Math.max(0, Math.round(8 + Math.sin(dateSeed * 0.2 + locationSeed + index) * 5)); // in knots
    const directions: WindDirection[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    forecast.direction = directions[Math.floor(((dateSeed / 5) + locationSeed + index * 2) % directions.length)];
    const windStabilities: ('Stable' | 'Tournant')[] = ['Stable', 'Tournant'];
    forecast.stability = windStabilities[Math.floor(((dateSeed / 2) + locationSeed + index) % windStabilities.length)];
  });

  // Vary Swell
  locationData.weather.swell = [];
  const swellTimes = ['00:00', '06:00', '12:00', '18:00'];
  swellTimes.forEach((time, index) => {
    const swellBase = 0.5;
    const inside = `${Math.max(0.1, swellBase + Math.sin(dateSeed * 0.3 + locationSeed * 0.1 + index * 2) * 0.4).toFixed(1)}m`;
    const swellOutsideBase = 1.2;
    const outside = `${Math.max(0.2, swellOutsideBase + Math.cos(dateSeed * 0.3 + locationSeed * 0.1 + index * 2) * 1).toFixed(1)}m`;
    const period = Math.max(4, Math.round(8 + Math.sin(dateSeed * 0.1 + index) * 3));
    locationData.weather.swell.push({ time, inside, outside, period });
  });

  // Vary Rain
  const rainChance = (Math.sin(dateSeed * 0.4 + locationSeed * 0.2) + 1) / 2; // Normalize to 0-1
  if (rainChance < 0.98) {
      locationData.weather.rain = 'Aucune';
  } else if (rainChance < 0.995) {
      locationData.weather.rain = 'Fine';
  } else {
      locationData.weather.rain = 'Forte';
  }

  // Vary Trend and UV Index
  const uvSeed = (Math.sin(dateSeed * 0.25 + locationSeed * 0.15) + 1) / 2;
  locationData.weather.uvIndex = Math.round(1 + uvSeed * 10);

  if (locationData.weather.rain === 'Forte') {
      locationData.weather.trend = 'Pluvieux';
      locationData.weather.uvIndex = Math.min(locationData.weather.uvIndex, 2);
  } else if (locationData.weather.rain === 'Fine') {
      locationData.weather.trend = 'Averses';
      locationData.weather.uvIndex = Math.min(locationData.weather.uvIndex, 5);
  } else { // No rain
      if (uvSeed > 0.95) { // higher threshold for "Ensoleillé"
          locationData.weather.trend = 'Ensoleillé';
      } else {
          locationData.weather.trend = 'Nuageux';
      }
  }
  locationData.weather.uvIndex = Math.max(1, Math.min(11, locationData.weather.uvIndex));


  // Vary Sun/Moon times
  locationData.weather.sun.sunrise = varyTime(baseData.weather.sun.sunrise, 1);
  locationData.weather.sun.sunset = varyTime(baseData.weather.sun.sunset, 2);
  locationData.weather.moon.moonrise = varyTime(baseData.weather.moon.moonrise, 3);
  locationData.weather.moon.moonset = varyTime(baseData.weather.moon.moonset, 4);

  // Farming data
  const lunarPhase = dayInCycle < 14.76 ? 'Lune Montante' : 'Lune Descendante';
  locationData.farming.lunarPhase = lunarPhase;
  const zodiacSigns = ['Fruits', 'Racines', 'Fleurs', 'Feuilles'];
  const zodiac = zodiacSigns[Math.floor((dayInCycle / (27.3/4)) % 4)] as 'Fruits' | 'Racines' | 'Fleurs' | 'Feuilles';
  locationData.farming.zodiac = zodiac;

  locationData.farming.isGoodForCuttings = lunarPhase === 'Lune Montante';
  locationData.farming.isGoodForPruning = lunarPhase === 'Lune Descendante';
  locationData.farming.isGoodForMowing = lunarPhase === 'Lune Descendante' && zodiac === 'Feuilles';
  
  const sow: string[] = [];
  const harvest: string[] = [];

  if (month >= 9 || month <= 2) { 
    if (zodiac === 'Fruits') { sow.push('Tomates', 'Aubergines', 'Poivrons'); harvest.push('Melons', 'Pastèques'); }
    if (zodiac === 'Racines') { sow.push('Carottes', 'Radis'); harvest.push('Patates douces', 'Manioc'); }
    if (zodiac === 'Feuilles') { sow.push('Salades', 'Brèdes'); harvest.push('Choux de Chine'); }
    if (zodiac === 'Fleurs') { sow.push('Fleurs annuelles'); harvest.push('Artichauts'); }
  } 
  else { 
    if (zodiac === 'Fruits') { sow.push('Pois', 'Haricots'); harvest.push('Citrouilles', 'Courgettes'); }
    if (zodiac === 'Racines') { sow.push('Oignons', 'Ail', 'Poireaux'); harvest.push('Carottes', 'Taro', 'Pommes de terre'); }
    if (zodiac === 'Feuilles') { sow.push('Choux', 'Épinards', 'Bettes'); harvest.push('Salades'); }
     if (zodiac === 'Fleurs') { sow.push('Brocolis', 'Choux-fleurs'); }
  }
  locationData.farming.sow = sow;
  locationData.farming.harvest = harvest;

  // Hunting data
  if (month >= 6 && month <= 7) { 
    locationData.hunting.period = { name: 'Brame', description: 'Période de reproduction des cerfs. Les mâles sont moins méfiants et plus actifs, même en journée.' };
  } else if (month >= 1 && month <= 2) { 
      locationData.hunting.period = { name: 'Chute des bois', description: 'Les cerfs mâles perdent leurs bois. Ils sont plus discrets et difficiles à repérer.' };
  } else {
      locationData.hunting.period = { name: 'Normal', description: 'Activité habituelle des cerfs, principalement à l\'aube et au crépuscule.' };
  }
  if (locationData.weather.rain === 'Fine') { locationData.hunting.advice.rain = 'Excellente condition, la pluie masque le bruit de vos pas.'; } 
  else if (locationData.weather.rain === 'Forte') { locationData.hunting.advice.rain = 'Chasse difficile, les animaux sont bloqués et peu mobiles.'; } 
  else { locationData.hunting.advice.rain = 'Temps sec, soyez particulièrement silencieux.'; }
  const isWindUnstable = locationData.weather.wind.some(f => f.stability === 'Tournant');
  if (!isWindUnstable) { locationData.hunting.advice.scent = 'Le vent stable vous permet de bien gérer votre odeur. Chassez face au vent.'; } 
  else { locationData.hunting.advice.scent = 'Le vent tournant rend la gestion des odeurs très difficile. Redoublez de prudence.'; }

    // Generate Hourly Forecasts
    locationData.weather.hourly = [];
    const startDate = new Date(effectiveDate);
    startDate.setHours(0, 0, 0, 0);
    const baseTempMin = 22 + (locationSeed % 5);
    const baseTempMax = baseTempMin + 8 + (locationSeed % 3);
    for (let i = 0; i < 48; i++) {
        const forecastDate = new Date(startDate.getTime() + i * 60 * 60 * 1000);
        const hour = forecastDate.getHours();
        const isNight = hour < 6 || hour > 19;
        const tempVariation = Math.sin((hour / 24) * Math.PI * 2 - Math.PI/2);
        const temp = Math.round(baseTempMin + ((baseTempMax - baseTempMin) / 2) * (1 + tempVariation) + Math.sin(dateSeed+i/2)*2);
        const directions: WindDirection[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
        const windDirection = directions[Math.floor((dateSeed/2 + hour/3 + locationSeed/100) % directions.length)];
        const windSpeedInKmh = 5 + Math.abs(Math.sin(dateSeed + hour/4 + locationSeed/1000)) * 25;
        const windSpeed = Math.round(windSpeedInKmh * 0.539957); // in knots
        let condition : HourlyForecast['condition'] = 'Ensoleillé';
        const conditionSeed = (Math.cos(dateSeed * 0.5 + i * 0.2 + locationSeed) + 1) / 2;
        if (isNight) {
            condition = conditionSeed > 0.6 ? 'Nuit claire' : 'Peu nuageux';
        } else {
            if (conditionSeed > 0.85) condition = 'Ensoleillé';
            else if (conditionSeed > 0.4) condition = 'Peu nuageux';
            else if (conditionSeed > 0.2) condition = 'Nuageux';
            else condition = 'Averses';
        }
        locationData.weather.hourly.push({ date: forecastDate.toISOString(), condition: condition, windSpeed: windSpeed, windDirection: windDirection, stability: 'Stable', isNight: isNight, temp: temp, tideHeight: 0, tideCurrent: 'Nul', tidePeakType: undefined });
    }
    const currentHourForecastForTemp = locationData.weather.hourly.find(f => new Date(f.date).getHours() === effectiveDate.getHours());
    if (currentHourForecastForTemp) { locationData.weather.temp = currentHourForecastForTemp.temp; }
    const dayForecasts = locationData.weather.hourly.slice(0, 24);
    if (dayForecasts.length > 0) {
      locationData.weather.tempMin = Math.min(...dayForecasts.map(f => f.temp));
      locationData.weather.tempMax = Math.max(...dayForecasts.map(f => f.temp));
    }

    // Crab and Lobster Data
    if (dayInCycle >= 27 || dayInCycle <= 3) {
        locationData.crabAndLobster = {...locationData.crabAndLobster, crabStatus: 'Plein', crabMessage: "Bonne période (nouvelle lune). Les crabes sont généralement pleins."};
    } else if (dayInCycle >= 12 && dayInCycle <= 18) {
        locationData.crabAndLobster = {...locationData.crabAndLobster, crabStatus: 'Plein', crabMessage: "Excellente période (pleine lune). Les crabes sont pleins et actifs."};
    } else if (dayInCycle > 3 && dayInCycle < 12) {
        locationData.crabAndLobster = {...locationData.crabAndLobster, crabStatus: 'Vide', crabMessage: "Période de 'crabes vides' (en mue). Moins intéressant pour la pêche."};
    } else {
        locationData.crabAndLobster = {...locationData.crabAndLobster, crabStatus: 'Mout', crabMessage: "Période de 'crabes mous' (en mue). Qualité de chair moindre et pêche interdite."};
    }
    if (illumination < 0.3) {
        locationData.crabAndLobster = {...locationData.crabAndLobster, lobsterActivity: 'Élevée', lobsterMessage: "Nuits sombres, activité élevée. Privilégiez l'intérieur du lagon et les platiers."};
    } else if (illumination > 0.7) {
        locationData.crabAndLobster = {...locationData.crabAndLobster, lobsterActivity: 'Faible', lobsterMessage: "Nuits claires, langoustes plus discrètes. Tentez votre chance à l'extérieur du récif ou plus en profondeur."};
    } else {
        locationData.crabAndLobster = {...locationData.crabAndLobster, lobsterActivity: 'Moyenne', lobsterMessage: "Activité moyenne. Pêche possible à l'intérieur et à l'extérieur du lagon."};
    }

    // Octopus Data
    let octopusActivity: 'Élevée' | 'Moyenne' | 'Faible' | null = null;
    let octopusMessage = '';
    
    const winterMonths = [5, 6, 7, 8]; // June to September
    const isWinter = winterMonths.includes(month);

    const lowTides = locationData.tides.filter(t => t.type === 'basse');
    const lowestTide = lowTides.length > 0 
        ? lowTides.reduce((prev, current) => (prev.height < current.height) ? prev : current)
        : null;

    const isVeryLowTide = lowestTide && lowestTide.height <= 0.25;

    if (isWinter && isVeryLowTide) {
        octopusActivity = 'Élevée';
        octopusMessage = `Excellente période pour la pêche à pied lors de la marée basse de ${lowestTide.time}. Cherchez-les dans les trous sur le platier.`;
    } else {
        // If conditions are not met, we don't display the octopus section by setting activity to null.
        octopusActivity = null;
        octopusMessage = '';
    }

    locationData.crabAndLobster.octopusActivity = octopusActivity;
    locationData.crabAndLobster.octopusMessage = octopusMessage;


    // Add hourly tide data
    const hourlyTideData = calculateHourlyTides(location, effectiveDate);
    locationData.weather.hourly.forEach(forecast => {
        const forecastDate = new Date(forecast.date);
        const correspondingTide = hourlyTideData.find(t => {
            const tideDate = new Date(t.date);
            return tideDate.getDate() === forecastDate.getDate() && tideDate.getHours() === forecastDate.getHours();
        });
        if (correspondingTide) {
            forecast.tideHeight = correspondingTide.tideHeight;
            forecast.tideCurrent = correspondingTide.tideCurrent;
            forecast.tidePeakType = correspondingTide.tidePeakType;
        }
    });

  return locationData;
}


export function getDataForDate(location: string, date: Date): LocationData {
  // Ensure date is valid, fallback to now if not.
  const validDate = date || new Date();
  const proceduralData = generateProceduralData(location, validDate);
  
  // All API fetching logic has been removed to ensure the app is self-contained and free.
  // The data is now fully procedural, eliminating external API errors and costs.
  return proceduralData;
}


export async function getTideArchiveStatus(firestore: Firestore): Promise<{ lastDate: string | null, stationCount: number }> {
    const stations = [...new Set(Object.values(communeToTideStationMap))];
    let latestDate: Date | null = null;

    for (const stationName of stations) {
        try {
            const tidesColRef = collection(firestore, `stations/${stationName}/tides`);
            const q = query(tidesColRef, orderBy('__name__', 'desc'), limit(1));
            const querySnapshot = await getDocs(q);
            
            if (!querySnapshot.empty) {
                const lastDocId = querySnapshot.docs[0].id;
                const docDate = new Date(lastDocId);
                 if (!latestDate || docDate > latestDate) {
                    latestDate = docDate;
                }
            }
        } catch (error) {
            console.error(`Failed to check tide archive for ${stationName}:`, error);
            // This might be a missing index error, but we continue to check other stations
        }
    }

    return {
        lastDate: latestDate ? latestDate.toISOString().split('T')[0] : null,
        stationCount: stations.length,
    };
}
