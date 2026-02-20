'use server';

/**
 * Service de récupération météo via Windy Point Forecast API.
 * Récupère le vent (vitesse/direction) et la houle.
 */
export async function fetchWindyWeather(lat: number, lon: number) {
  // CLÉ API WINDY (Vérifiée via capture d'écran)
  const API_KEY = 'ggM4kZBn2QoBp91yLUHBvv5wAYfbxJuU';
  const url = 'https://api.windy.com/api/point-forecast/v2';
  
  // REFERER : Doit correspondre EXACTEMENT à l'identifiant saisi dans la console Windy
  // L'utilisateur a saisi l'URL du projet Studio.
  const projectReferer = 'https://studio.firebase.google.com/project/studio-2943478321-f746e';

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Referer': projectReferer
      },
      body: JSON.stringify({
        lat,
        lon,
        model: 'gfs',
        parameters: ['wind', 'windDir', 'waves'],
        key: API_KEY
      })
    });

    if (response.status === 429) {
        return { success: false, error: "Quota Windy atteint" };
    }

    if (!response.ok) {
        throw new Error(`Windy API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Windy retourne des séries temporelles. On prend le premier index (maintenant).
    return {
      windSpeed: data.wind?.[0] !== undefined ? Math.round(data.wind[0] * 1.94384) : 0,
      windDir: data.windDir?.[0] || 0,
      wavesHeight: data.waves?.[0] || 0,
      success: true
    };
  } catch (error) {
    console.error("Windy API Fetch failed:", error);
    return { success: false, error: "Erreur technique météo" };
  }
}
