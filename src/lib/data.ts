
import { LocationData, SwellForecast, Tide, WindDirection, WindForecast, HourlyForecast } from './types';
import { locations } from './locations';
import { Firestore, doc, getDoc, collection, getDocs, limit, orderBy, query } from 'firebase/firestore';

// Cache simple pour éviter les calculs procéduraux redondants
const proceduralCache = new Map<string, LocationData>();

/**
 * STATIONS DE RÉFÉRENCE (Source: Météo NC / SHOM)
 * Ces données servent de base moyenne pour les calculs.
 * Ajustées pour permettre d'atteindre les seuils critiques lors des vives-eaux.
 */
const tideStations = {
  'Nouméa': {
    tides: [
      { type: 'haute', time: '07:20', height: 1.52, current: 'Fort' },
      { type: 'basse', time: '13:45', height: 0.28, current: 'Modéré' },
      { type: 'haute', time: '19:30', height: 1.35, current: 'Fort' },
      { type: 'basse', time: '01:20', height: 0.32, current: 'Modéré' },
    ]
  },
  'Bourail': {
    tides: [
      { type: 'haute', time: '08:40', height: 1.58, current: 'Fort' },
      { type: 'basse', time: '15:00', height: 0.35, current: 'Modéré' },
      { type: 'haute', time: '20:30', height: 1.30, current: 'Fort' },
      { type: 'basse', time: '02:00', height: 0.22, current: 'Modéré' },
    ]
  },
  'Koné': {
     tides: [
      { type: 'haute', time: '10:30', height: 1.62, current: 'Fort' },
      { type: 'basse', time: '16:45', height: 0.42, current: 'Modéré' },
      { type: 'haute', time: '23:00', height: 1.55, current: 'Fort' },
      { type: 'basse', time: '04:15', height: 0.38, current: 'Modéré' },
    ]
  },
  'Thio': {
    tides: [
      { type: 'haute', time: '10:10', height: 1.45, current: 'Fort' },
      { type: 'basse', time: '16:20', height: 0.25, current: 'Modéré' },
      { type: 'haute', time: '22:40', height: 1.38, current: 'Fort' },
      { type: 'basse', time: '03:50', height: 0.28, current: 'Modéré' },
    ]
  },
  'Koumac': {
    tides: [
      { type: 'haute', time: '10:20', height: 1.72, current: 'Fort' },
      { type: 'basse', time: '17:00', height: 0.48, current: 'Modéré' },
      { type: 'haute', time: '22:50', height: 1.65, current: 'Fort' },
      { type: 'basse', time: '03:50', height: 0.45, current: 'Modéré' },
    ]
  },
  'Hienghène': {
    tides: [
      { type: 'haute', time: '09:30', height: 1.28, current: 'Fort' },
      { type: 'basse', time: '15:45', height: 0.28, current: 'Modéré' },
      { type: 'haute', time: '21:40', height: 1.22, current: 'Fort' },
      { type: 'basse', time: '03:15', height: 0.32, current: 'Modéré' },
    ]
  },
  'Ouvéa': {
    tides: [
      { type: 'haute', time: '09:00', height: 1.35, current: 'Fort' },
      { type: 'basse', time: '15:15', height: 0.32, current: 'Modéré' },
      { type: 'haute', time: '20:50', height: 1.18, current: 'Fort' },
      { type: 'basse', time: '02:30', height: 0.38, current: 'Modéré' },
    ]
  }
};

/**
 * MAPPING COMMUNE -> STATION
 * Définit quelle station de référence est la plus proche géographiquement.
 */
export const communeToTideStationMap: { [key: string]: string } = {
  'Bélep': 'Koumac', 
  'Boulouparis': 'Nouméa', 
  'Bourail': 'Bourail', 
  'Canala': 'Thio',
  'Dumbéa': 'Nouméa', 
  'Farino': 'Bourail', 
  'Hienghène': 'Hienghène', 
  'Houaïlou': 'Thio',
  "L'Île-des-Pins": 'Nouméa', 
  'Kaala-Gomen': 'Koumac', 
  'Koné': 'Koné', 
  'Kouaoua': 'Thio',
  'Koumac': 'Koumac', 
  'La Foa': 'Bourail', 
  'Le Mont-Dore': 'Nouméa', 
  'Lifou': 'Ouvéa',
  'Maré': 'Ouvéa', 
  'Moindou': 'Bourail', 
  'Nouméa': 'Nouméa', 
  'Ouégoa': 'Koumac',
  'Ouvéa': 'Ouvéa', 
  'Païta': 'Nouméa', 
  'Poindimié': 'Hienghène', 
  'Ponérihouen': 'Hienghène',
  'Pouébo': 'Hienghène', 
  'Pouembout': 'Koné', 
  'Poum': 'Koumac', 
  'Poya': 'Koné',
  'Sarraméa': 'Bourail', 
  'Thio': 'Thio', 
  'Voh': 'Koné', 
  'Yaté': 'Nouméa',
};

// Données de base par défaut
const baseData: Omit<LocationData, 'tides' | 'tideStation'> = {
  weather: {
    wind: [
      { time: '03:00', speed: 0, direction: 'N', stability: 'Stable' },
      { time: '09:00', speed: 0, direction: 'N', stability: 'Stable' },
      { time: '15:00', speed: 0, direction: 'N', stability: 'Stable' },
      { time: '21:00', speed: 0, direction: 'N', stability: 'Stable' },
    ],
    swell: [],
    sun: { sunrise: '06:31', sunset: '17:45' },
    moon: { moonrise: '12:05', moonset: '23:55', phase: 'Premier quartier', percentage: 50 },
    rain: 'Aucune', trend: 'Ensoleillé', uvIndex: 7, temp: 26, tempMin: 23, tempMax: 33, waterTemperature: 24, hourly: [],
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
        { name: 'Wahoo', rating: 9, location: 'Large', advice: { activity: 'Très forte activité à l\'aube.', feeding: 'Excellente heure.', location_specific: 'Tombants.', depth: 'Surface.' } },
        { name: 'Bec de cane', rating: 9, location: 'Lagon', advice: { activity: 'En bancs.', feeding: 'Très bonne heure.', location_specific: 'Platiers.', depth: '2-10m.' } },
      ],
    },
    {
      timeOfDay: 'Matinée (09:00 - 11:00)', tide: '', tideTime: '', tideMovement: 'étale',
      fish: [
        { name: 'Thon Jaune', rating: 6, location: 'Large', advice: { activity: 'Activité en baisse.', feeding: 'Moins prévisible.', location_specific: 'DCP.', depth: '20-50m.' } },
      ],
    },
    {
      timeOfDay: 'Après-midi (15:00 - 17:00)', tide: '', tideTime: '', tideMovement: 'étale',
      fish: [
        { name: 'Carangue', rating: 6, location: 'Lagon', advice: { activity: 'L\'activité reprend.', feeding: 'Bonne heure.', location_specific: 'Passes.', depth: 'Surface à 15m.' } },
      ],
    },
    {
      timeOfDay: 'Crépuscule (17:30 - 19:00)', tide: '', tideTime: '', tideMovement: 'étale',
      fish: [
        { name: 'Carangue', rating: 9, location: 'Lagon', advice: { activity: 'Très forte activité.', feeding: 'Excellente heure.', location_specific: 'Passes.', depth: 'Surface à 10m.' } },
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

/**
 * GÉNÉRATEUR PROCÉDURAL PRINCIPAL
 * Calcule toutes les données météo, pêche et lune pour une date et un lieu donnés.
 */
export function generateProceduralData(location: string, date: Date): LocationData {
  const dateKey = date.toISOString().split('T')[0];
  const cacheKey = `${location}-${dateKey}`;
  
  if (proceduralCache.has(cacheKey)) {
    return proceduralCache.get(cacheKey)!;
  }

  const effectiveDate = new Date(dateKey);
  const dayOfMonth = effectiveDate.getDate();
  const month = effectiveDate.getMonth();
  const year = effectiveDate.getFullYear();

  // Création des "seeds" (graines) pour que le hasard soit prévisible pour un jour donné
  const locationSeed = location.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const dateSeed = dayOfMonth + month * 31 + year * 365.25;

  const varyTime = (time: string, offset: number) => {
    let [h, m] = time.split(':').map(Number);
    m += Math.floor(Math.sin(dateSeed * 0.05 + locationSeed + offset) * 15);
    if (m >= 60) { h = (h + 1) % 24; m %= 60; }
    if (m < 0) { h = (h - 1 + 24) % 24; m += 60; }
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  }

  // Calcul Phase Lunaire
  const phases: string[] = ['Nouvelle lune', 'Premier croissant', 'Premier quartier', 'Lune gibbeuse croissante', 'Pleine lune', 'Lune gibbeuse décroissante', 'Dernier quartier', 'Dernier croissant'];
  const knownNewMoon = new Date('2024-01-11T00:00:00Z');
  const daysSinceKnownNewMoon = (effectiveDate.getTime() - knownNewMoon.getTime()) / (1000 * 3600 * 24);
  const dayInCycle = daysSinceKnownNewMoon % 29.53;
  
  // Facteur d'amplitude boosté pour permettre d'atteindre les seuils critiques (>1.65 et <0.20)
  const springFactor = 1 + 0.42 * Math.abs(Math.cos((dayInCycle / 29.53) * 2 * Math.PI));

  // 1. Déterminer la station de référence et récupérer les marées de base
  const tideStation = communeToTideStationMap[location] || 'Nouméa';
  const stationTides = tideStations[tideStation as keyof typeof tideStations] || tideStations['Nouméa'];

  // 2. Créer l'objet de données
  const locationData: LocationData = {
      ...JSON.parse(JSON.stringify(baseData)),
      tides: JSON.parse(JSON.stringify(stationTides.tides)),
      tideStation: tideStation
  };

  // Ajustement des marées selon le cycle lunaire (Amplitude)
  locationData.tides.forEach((tide: Tide, i: number) => {
    const baseTide = stationTides.tides[i % stationTides.tides.length];
    const variation = Math.sin((dateSeed * (1 + i * 0.1) + locationSeed * 0.2)) * 0.04;
    
    if (tide.type === 'haute') {
        tide.height = parseFloat((baseTide.height * springFactor + variation).toFixed(2));
    } else {
        // En vives-eaux, la basse mer est plus basse (division par le facteur)
        tide.height = parseFloat((baseTide.height / springFactor + variation).toFixed(2));
    }
    tide.time = varyTime(baseTide.time, i + 5);
  });
  
  const timeToMinutes = (timeStr: string) => {
      const [hours, minutes] = timeStr.split(':').map(Number);
      return hours * 60 + minutes;
  };

  // Calcul du mouvement de marée pour chaque créneau de pêche
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
        const slotEndMinutes = slotStartMinutes + 120;
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
            slot.tideMovement = nextTide.type === 'haute' ? 'montante' : 'descendante';
        } else {
             slot.tideMovement = 'étale';
        }
    }
  });
  
  const phaseIndex = Math.floor((dayInCycle / 29.53) * 8 + 0.5) % 8;
  locationData.weather.moon.phase = phases[phaseIndex];
  
  const illumination = 0.5 * (1 - Math.cos((dayInCycle / 29.53) * 2 * Math.PI));
  locationData.weather.moon.percentage = Math.round(illumination * 100);

  const warmSeasonMonths = [8, 9, 10, 11, 0, 1, 2, 3];
  const isPelagicSeason = warmSeasonMonths.includes(month);
  
  locationData.pelagicInfo = {
      inSeason: isPelagicSeason,
      message: isPelagicSeason
          ? 'La saison chaude bat son plein !'
          : 'Hors saison pour les grands pélagiques.'
  };

  // Calcul des indices de pêche (1 à 10)
  locationData.fishing.forEach((slot) => {
    slot.fish.forEach((f) => {
      let rating = 1;
      if (slot.timeOfDay.includes('Aube') || slot.timeOfDay.includes('Crépuscule')) rating += 3.5;
      else rating -= 2;
      
      if (slot.tideMovement !== 'étale') rating += 3.5;
      else rating -= 6;
      
      const isNearNewOrFullMoon = (dayInCycle < 4 || dayInCycle > 25.5) || (dayInCycle > 10.75 && dayInCycle < 18.75);
      if (isNearNewOrFullMoon) rating += 3.5;

      const randomFactor = Math.sin(dateSeed * 0.1 + locationSeed * 0.05 + slot.timeOfDay.length);
      rating += randomFactor;
      f.rating = Math.max(1, Math.min(10, Math.round(rating)));
    });
  });

  // Simulation du vent
  locationData.weather.wind.forEach((forecast: WindForecast, index: number) => {
    forecast.speed = Math.max(0, Math.round(8 + Math.sin(dateSeed * 0.2 + locationSeed + index) * 5));
    const directions: WindDirection[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    forecast.direction = directions[Math.floor(((dateSeed / 5) + locationSeed + index * 2) % directions.length)];
    forecast.stability = (Math.sin(dateSeed + index) > 0) ? 'Stable' : 'Tournant';
  });

  // Simulation de la pluie et UV
  const rainChance = (Math.sin(dateSeed * 0.4 + locationSeed * 0.2) + 1) / 2;
  locationData.weather.rain = rainChance < 0.98 ? 'Aucune' : (rainChance < 0.995 ? 'Fine' : 'Forte');
  
  // Farming logic (Lune montante/descendante)
  const lunarPhase = dayInCycle < 14.76 ? 'Lune Montante' : 'Lune Descendante';
  locationData.farming.lunarPhase = lunarPhase;
  const zodiacSigns = ['Fruits', 'Racines', 'Fleurs', 'Feuilles'];
  const zodiac = zodiacSigns[Math.floor((dayInCycle / (27.3/4)) % 4)] as 'Fruits' | 'Racines' | 'Fleurs' | 'Feuilles';
  locationData.farming.zodiac = zodiac;

  // Simulation des données horaires pour la courbe de marée
  locationData.weather.hourly = [];
  const tideDataForDay = calculateHourlyTidesForSimulation(locationData.tides, date);
  
  for (let i = 0; i < 24; i++) {
      const forecastDate = new Date(effectiveDate.getTime() + i * 60 * 60 * 1000);
      const tideAtHour = tideDataForDay.find(td => new Date(td.date).getHours() === i);
      
      locationData.weather.hourly.push({
          date: forecastDate.toISOString(),
          condition: 'Ensoleillé',
          windSpeed: locationData.weather.wind[Math.floor(i/6)]?.speed || 10,
          windDirection: locationData.weather.wind[Math.floor(i/6)]?.direction || 'E',
          stability: locationData.weather.wind[Math.floor(i/6)]?.stability || 'Stable',
          isNight: i < 6 || i > 18,
          temp: 25,
          tideHeight: tideAtHour?.tideHeight || 0,
          tideCurrent: tideAtHour?.tideCurrent || 'Nul',
          tidePeakType: tideAtHour?.tidePeakType
      });
  }

  proceduralCache.set(cacheKey, locationData);
  return locationData;
}

/**
 * Calcul de la courbe de marée horaire pour la simulation météo
 */
function calculateHourlyTidesForSimulation(dailyTides: Tide[], baseDate: Date): any[] {
    const timeToMinutes = (timeStr: string) => {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
    };

    const sortedTides = [...dailyTides].sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
    const results = [];
    const startDate = new Date(baseDate);
    startDate.setHours(0, 0, 0, 0);

    for (let h = 0; i < 24; i++) {
        const currentMinutes = i * 60;
        let prevTide = sortedTides.filter(t => timeToMinutes(t.time) <= currentMinutes).pop();
        let nextTide = sortedTides.find(t => timeToMinutes(t.time) > currentMinutes);

        // Fallback si on est en début ou fin de journée
        if (!prevTide) prevTide = { ...sortedTides[sortedTides.length - 1], time: '00:00' };
        if (!nextTide) nextTide = { ...sortedTides[0], time: '23:59' };

        const duration = timeToMinutes(nextTide.time) - timeToMinutes(prevTide.time);
        const elapsed = currentMinutes - timeToMinutes(prevTide.time);
        const phase = duration > 0 ? (elapsed / duration) * Math.PI : 0;

        const amplitude = (prevTide.height - nextTide.height) / 2;
        const midline = (prevTide.height + nextTide.height) / 2;
        const height = midline + amplitude * Math.cos(phase);

        results.push({
            date: new Date(startDate.getTime() + i * 60 * 60 * 1000).toISOString(),
            tideHeight: height,
            tideCurrent: Math.abs(Math.sin(phase)) > 0.7 ? 'Fort' : 'Modéré',
            tidePeakType: Math.abs(currentMinutes - timeToMinutes(prevTide.time)) < 45 ? prevTide.type : undefined
        });
    }
    return results;
}

export function getDataForDate(location: string, date: Date): LocationData {
  return generateProceduralData(location, date);
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
                const docDate = new Date(querySnapshot.docs[0].id);
                 if (!latestDate || docDate > latestDate) { latestDate = docDate; }
            }
        } catch (error) { console.error(`Failed to check tide archive for ${stationName}:`, error); }
    }
    return { lastDate: latestDate ? latestDate.toISOString().split('T')[0] : null, stationCount: stations.length };
}
