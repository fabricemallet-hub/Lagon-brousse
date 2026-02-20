'use server';

/**
 * Service de récupération météo via Windy Point Forecast API.
 * Récupère le vent (vitesse/direction) et la houle.
 */
export async function fetchWindyWeather(lat: number, lon: number) {
  // CLÉ API WINDY
  const API_KEY = 'ggM4kZBn2QoBp91yLUHBvv5wAYfbxJuU';
  const url = 'https://api.windy.com/api/point-forecast/v2';
  
  // REFERER : Doit correspondre EXACTEMENT à l'identifiant saisi dans la console Windy
  const projectReferer = 'https://studio.firebase.google.com/project/studio-2943478321-f746e';

  try {
    const cleanLat = Number(lat);
    const cleanLon = Number(lon);

    if (isNaN(cleanLat) || isNaN(cleanLon)) {
        throw new Error("Coordonnées GPS invalides");
    }

    console.log(`[Windy] Appel API pour ${cleanLat}, ${cleanLon}`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-windy-api-key': API_KEY,
        'Referer': projectReferer,
        'Origin': 'https://studio.firebase.google.com'
      },
      body: JSON.stringify({
        lat: cleanLat,
        lon: cleanLon,
        model: 'gfs',
        parameters: ['wind', 'windDir', 'waves']
      })
    });

    if (response.status === 429) {
        return { success: false, error: "Quota Windy atteint" };
    }

    if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Windy] Erreur API ${response.status}:`, errorText);
        return { success: false, error: `Erreur Windy ${response.status}` };
    }

    const data = await response.json();
    
    // Extraction des données (index 0 pour le temps présent)
    return {
      windSpeed: data.wind?.[0] !== undefined ? Math.round(data.wind[0] * 1.94384) : 0,
      windDir: data.windDir?.[0] || 0,
      wavesHeight: data.waves?.[0] || 0,
      success: true
    };
  } catch (error: any) {
    console.error("[Windy] Échec critique fetch:", error);
    return { success: false, error: error.message || "Erreur technique météo" };
  }
}
