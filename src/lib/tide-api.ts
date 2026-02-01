'use client';
import { Firestore, writeBatch, doc, setDoc } from 'firebase/firestore';
import { communeToTideStationMap } from './data';
import { locations } from './locations';
import { Tide } from './types';

interface WorldTidesExtreme {
    dt: number;
    date: string;
    height: number;
    type: 'High' | 'Low';
}

interface WorldTidesResponse {
    status: number;
    callCount: number;
    copyright: string;
    requestLat: number;
    requestLon: number;
    responseLat: number;
    responseLon: number;
    atlas: string;
    station: string;
    extremes: WorldTidesExtreme[];
    error?: string;
}

const stationCoords: Record<string, { lat: number, lon: number }> = {
    'Nouméa': { lat: -22.27, lon: 166.45 },
    'Bourail': { lat: -21.56, lon: 165.48 },
    'Koné': { lat: -21.05, lon: 164.86 },
    'Thio': { lat: -21.61, lon: 166.21 },
    'Koumac': { lat: -20.56, lon: 164.28 },
    'Hienghène': { lat: -20.68, lon: 164.93 },
    'Ouvéa': { lat: -20.45, lon: 166.56 },
};

export async function updateTideArchive(firestore: Firestore): Promise<void> {
    const apiKey = process.env.NEXT_PUBLIC_WORLDTIDES_API_KEY;
    if (!apiKey || apiKey === 'YOUR_WORLDTIDES_API_KEY_HERE') {
        throw new Error("La clé API WorldTides n'est pas configurée dans le fichier .env");
    }

    const stationsToUpdate = Object.values(communeToTideStationMap).filter((value, index, self) => self.indexOf(value) === index);
    const startDate = new Date();
    const startTimestamp = Math.floor(startDate.getTime() / 1000);

    for (const stationName of stationsToUpdate) {
        const coords = stationCoords[stationName];
        if (!coords) {
            console.warn(`Coordonnées non trouvées pour la station ${stationName}, ignorée.`);
            continue;
        }

        // Initialize station document if it doesn't exist
        const stationDocRef = doc(firestore, 'stations', stationName);
        await setDoc(stationDocRef, { name: stationName, lat: coords.lat, lon: coords.lon }, { merge: true });

        const url = `https://www.worldtides.info/api/v3?extremes&lat=${coords.lat}&lon=${coords.lon}&start=${startTimestamp}&days=7&key=${apiKey}`;
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Erreur de l'API WorldTides pour ${stationName}: ${response.statusText}`);
        }
        const data: WorldTidesResponse = await response.json();

        if (data.status !== 200 || data.error) {
            throw new Error(`Erreur de l'API WorldTides pour ${stationName}: ${data.error || `Status ${data.status}`}`);
        }

        const tidesByDay: Record<string, Omit<Tide, 'current'>[]> = {};

        data.extremes.forEach(extreme => {
            const date = new Date(extreme.dt * 1000);
            // Use UTC date to prevent timezone-related off-by-one errors
            const dateKey = date.toISOString().split('T')[0]; 
            const time = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Pacific/Noumea' });

            if (!tidesByDay[dateKey]) {
                tidesByDay[dateKey] = [];
            }
            tidesByDay[dateKey].push({
                type: extreme.type === 'High' ? 'haute' : 'basse',
                time: time,
                height: parseFloat(extreme.height.toFixed(2)),
            });
        });

        const batch = writeBatch(firestore);
        Object.entries(tidesByDay).forEach(([dateStr, tides]) => {
            if (tides.length > 0) {
                const docRef = doc(firestore, `stations/${stationName}/tides/${dateStr}`);
                batch.set(docRef, { tides });
            }
        });
        await batch.commit();
        console.log(`Archive des marées pour ${stationName} mise à jour.`);
    }
}
