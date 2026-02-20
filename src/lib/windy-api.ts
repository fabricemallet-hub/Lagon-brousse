
'use server';

import { headers } from 'next/headers';

/**
 * Service de récupération météo via Windy Point Forecast API v2.
 * Résolution exclusive de l'Erreur 400 par mise en conformité stricte du Payload.
 * @param lat Latitude du point (doit être un nombre)
 * @param lon Longitude du point (doit être un nombre)
 */
export async function fetchWindyWeather(lat: number, lon: number) {
  const API_KEY = 'ggM4kZBn2QoBp91yLUHBvv5wAYfbxJuU';
  const url = 'https://api.windy.com/api/point-forecast/v2';
  const PRODUCTION_URL = 'https://studio-2943478321-f746e.web.app';
  
  try {
    // 1. DATA INTEGRITY : Conversion explicite en Number pur (sans guillemets)
    const cleanLat = Number(lat);
    const cleanLon = Number(lon);

    if (isNaN(cleanLat) || isNaN(cleanLon)) {
        throw new Error("Coordonnées GPS invalides");
    }

    // 2. KEY MAPPING & STRUCTURE : Clé dans le JSON, 'lon' utilisé, paramètres restreints selon doc V2
    const requestBody = {
      lat: cleanLat,
      lon: cleanLon,
      model: 'gfs',
      parameters: ['wind'],
      levels: ['surface'],
      key: API_KEY
    };

    // LOG DE DIAGNOSTIC : Permet de vérifier la structure exacte envoyée dans la console serveur
    console.log("[Windy API] Payload JSON envoyé :", JSON.stringify(requestBody));
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 
        // 3. HEADER VALIDATION : Content-Type indispensable pour le parsing serveur Windy
        'Content-Type': 'application/json',
        // 4. NETWORK ORIGIN : Correspondance avec l'URL de production enregistrée
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
    
    // 5. EXTRACTION : Conversion m/s en Noeuds (nds)
    // Windy renvoie des tableaux de prévisions horaires, on prend l'index 0 (actuel)
    return {
      windSpeed: data.wind?.[0] !== undefined ? Math.round(data.wind[0] * 1.94384) : 0,
      success: true,
      status: 200
    };
  } catch (error: any) {
    console.error("[Windy Critical] Fetch failure:", error);
    return { success: false, error: error.message || "Network Error", status: 500 };
  }
}
