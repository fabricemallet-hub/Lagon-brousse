'use server';

/**
 * Service de récupération météo via Windy Point Forecast API v2.
 * Résolution exclusive de l'Erreur 400 (v4.7).
 * @param lat Latitude du point
 * @param lon Longitude du point
 */
export async function fetchWindyWeather(lat: number, lon: number) {
  const API_KEY = 'ggM4kZBn2QoBp91yLUHBvv5wAYfbxJuU';
  const url = 'https://api.windy.com/api/point-forecast/v2';
  const PRODUCTION_URL = 'https://studio-2943478321-f746e.web.app/'; // Avec slash final pour conformité Referer
  
  try {
    // 1. DATA INTEGRITY : Conversion forcée en Number pur (sans guillemets dans le JSON)
    const cleanLat = Number(parseFloat(lat.toString()).toFixed(6));
    const cleanLon = Number(parseFloat(lon.toString()).toFixed(6));

    if (isNaN(cleanLat) || isNaN(cleanLon)) {
        throw new Error("Coordonnées GPS invalides");
    }

    // 2. KEY MAPPING & STRUCTURE : Clé dans le JSON, 'lon' utilisé, paramètres restreints
    // Windy V2 rejette les paramètres inconnus.
    const requestBody = {
      lat: cleanLat,
      lon: cleanLon,
      model: 'gfs',
      parameters: ['wind'],
      levels: ['surface'],
      key: API_KEY
    };

    // LOG DE DIAGNOSTIC : Structure exacte envoyée
    console.log("[Windy API] Payload JSON :", JSON.stringify(requestBody));
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 
        // 3. HEADER VALIDATION : Content-Type indispensable
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
    console.error("[Windy Critical] Fetch failure:", error);
    return { success: false, error: error.message || "Network Error", status: 500 };
  }
}
