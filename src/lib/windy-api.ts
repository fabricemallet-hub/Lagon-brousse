'use server';

/**
 * Service de récupération météo via Windy Point Forecast API v2.
 * Version 4.8 : Résolution de l'Erreur 400 par conformité JSON stricte.
 */
export async function fetchWindyWeather(lat: number, lon: number) {
  const API_KEY = 'ggM4kZBn2QoBp91yLUHBvv5wAYfbxJuU';
  const url = 'https://api.windy.com/api/point-forecast/v2';
  const PRODUCTION_URL = 'https://studio-2943478321-f746e.web.app/'; 
  
  try {
    // 1. DATA INTEGRITY : Conversion forcée en Number pur
    const cleanLat = Number(parseFloat(lat.toString()).toFixed(6));
    const cleanLon = Number(parseFloat(lon.toString()).toFixed(6));

    if (isNaN(cleanLat) || isNaN(cleanLon)) {
        throw new Error("Coordonnées GPS invalides");
    }

    // 2. STRUCTURE JSON V2 : La clé API doit être dans le corps du JSON
    const requestBody = {
      lat: cleanLat,
      lon: cleanLon,
      model: 'gfs',
      parameters: ['wind'],
      levels: ['surface'],
      key: API_KEY
    };

    // LOG DE DIAGNOSTIC : Visualisation de la structure exacte envoyée
    console.log("[Windy API v4.8] Payload JSON :", JSON.stringify(requestBody));
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Referer': PRODUCTION_URL,
        'Origin': PRODUCTION_URL
      },
      body: JSON.stringify(requestBody)
    });

    // 3. GESTION DES RÉPONSES
    if (response.status === 400) {
        const errorText = await response.text();
        console.error("[Windy 400] Rejet structurelle :", errorText);
        return { success: false, error: "Requête mal formée (400)", status: 400 };
    }

    if (response.status === 204) {
        return { success: false, error: "Aucune donnée pour ce point (204)", status: 204 };
    }

    if (!response.ok) {
        return { success: false, error: `Erreur ${response.status}`, status: response.status };
    }

    const data = await response.json();
    
    // Windy renvoie des tableaux de prévisions horaires, on prend l'index 0 (actuel)
    // Conversion m/s en Noeuds (nds) : 1 m/s = 1.94384 nds
    return {
      windSpeed: data.wind?.[0] !== undefined ? Math.round(data.wind[0] * 1.94384) : 0,
      windDir: data['wind-dir']?.[0] || 0,
      wavesHeight: data.waves?.[0] || 0,
      success: true,
      status: 200
    };
  } catch (error: any) {
    console.error("[Windy Critical] Failure:", error);
    return { success: false, error: error.message || "Network Error", status: 500 };
  }
}
