
'use server';

import { headers } from 'next/headers';

/**
 * Service de récupération météo via Windy Point Forecast API v2.
 * @param lat Latitude du point (doit être un nombre)
 * @param lon Longitude du point (doit être un nombre)
 */
export async function fetchWindyWeather(lat: number, lon: number) {
  const API_KEY = 'ggM4kZBn2QoBp91yLUHBvv5wAYfbxJuU';
  const url = 'https://api.windy.com/api/point-forecast/v2';
  
  try {
    const headersList = await headers();
    const PRODUCTION_URL = 'https://studio-2943478321-f746e.web.app';
    
    // FORMATAGE CRITIQUE : Windy exige des types Number purs avec précision fixe
    const cleanLat = Number(Number(lat).toFixed(6));
    const cleanLon = Number(Number(lon).toFixed(6));

    if (isNaN(cleanLat) || isNaN(cleanLon)) {
        throw new Error("Coordonnées GPS invalides");
    }

    // Payload STRICT pour Windy V2 Point Forecast
    // Note: Windy rejette les propriétés inconnues. On n'envoie que le nécessaire.
    const requestBody = {
      lat: cleanLat,
      lon: cleanLon, // Windy utilise 'lon' et non 'lng'
      model: 'gfs',
      parameters: ['wind', 'windDir', 'waves'],
      levels: ['surface'],
      key: API_KEY // Clé dans le JSON comme demandé pour V2
    };

    // LOG DE DIAGNOSTIC (Visible dans les logs serveurs Firebase)
    console.log("[Windy API] Envoi du payload:", JSON.stringify(requestBody));
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Referer': PRODUCTION_URL,
        'Origin': PRODUCTION_URL
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Windy Error] Status: ${response.status}`, errorText);
        return { 
            success: false, 
            error: `Erreur ${response.status}`, 
            status: response.status
        };
    }

    const data = await response.json();
    
    return {
      // Conversion m/s en Noeuds (nds)
      windSpeed: data.wind?.[0] !== undefined ? Math.round(data.wind[0] * 1.94384) : 0,
      windDir: data.windDir?.[0] || 0,
      wavesHeight: data.waves?.[0] || 0,
      success: true,
      status: 200
    };
  } catch (error: any) {
    console.error("[Windy Critical] Fetch failure:", error);
    return { success: false, error: error.message || "Network Error", status: 500 };
  }
}
