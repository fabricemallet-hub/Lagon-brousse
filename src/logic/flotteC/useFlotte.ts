'use client';

import { useCallback } from 'react';
import { useFirestore } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { fetchWindyWeather } from '@/lib/windy-api';

/**
 * LOGIQUE FLOTTE (C) v121.0
 * Gère les signalements tactiques avec intégration météo Windy.
 */
export function useFlotte(sharingId?: string, vesselNickname?: string) {
    const firestore = useFirestore();

    const addTacticalLog = useCallback(async (type: string, lat: number, lng: number) => {
        if (!firestore || !sharingId) return;

        let weatherData = null;
        try {
            // v121.0 : On communique réellement avec Windy lors du signalement
            const weather = await fetchWindyWeather(lat, lng);
            if (weather.success) {
                weatherData = {
                    windSpeed: weather.windSpeed,
                    temp: weather.temp,
                    windDir: weather.windDir,
                    waves: weather.waves
                };
            }
        } catch (e) {
            console.error("Failed to fetch weather for tactical log", e);
        }

        const logEntry: any = {
            type: type.toUpperCase(),
            time: serverTimestamp(),
            pos: { latitude: lat, longitude: lng },
            vesselId: sharingId,
            vesselName: vesselNickname || sharingId,
            weather: weatherData
        };

        // v121.0 : Correction du chemin pour synchronisation avec les marqueurs de carte
        await addDoc(collection(firestore, 'vessels', sharingId, 'tactical_logs'), logEntry);
    }, [firestore, sharingId, vesselNickname]);

    return { addTacticalLog };
}
