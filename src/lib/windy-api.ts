'use server';

import { headers } from 'next/headers';

/**
 * Service de récupération météo via Windy Point Forecast API v2.
 * @param lat Latitude du point (doit être un nombre)
 * @param lon Longitude du point (doit être un nombre)
 */
export async function fetchWindyWeather(lat: number, lon: number) {
  // CLÉ API WINDY VÉRIFIÉE
  const API_KEY = 'ggM4kZBn2QoBp91yLUHBvv5wAYfbxJuU';
  const url = 'https://api.windy.com/api/point-forecast/v2';
  
  try {
    // Récupération dynamique du Referer pour supporter localhost et la prod
    const headersList = await headers();
    const currentReferer = headersList.get('referer') || 'https://studio.firebase.google.com/project/studio-2943478321-f746e';

    // FORMATAGE CRITIQUE : Windy exige des types Number (pas de String)
    const cleanLat = Number(lat);
    const cleanLon = Number(lon);

    if (isNaN(cleanLat) || isNaN(cleanLon)) {
        throw new Error("Coordonnées GPS invalides (NaN)");
    }

    // Payload STRICT pour Windy V2
    const requestBody = {
      lat: cleanLat,
      lon: cleanLon,
      model: 'gfs',
      parameters: ['wind', 'windDir', 'waves'],
      levels: ['surface']
    };

    console.log(`[Windy Debug] Envoi vers ${url} avec Referer: ${currentReferer}`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-windy-api-key': API_KEY,
        'Referer': currentReferer,
        'Origin': new URL(currentReferer).origin
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Windy Error] Status: ${response.status}`, errorText);
        return { 
            success: false, 
            error: `Windy ${response.status}`, 
            status: response.status,
            details: errorText 
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
