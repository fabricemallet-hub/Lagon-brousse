'use client';

import React, { useEffect, useState } from 'react';

const MAP_KEY = '1gGmSQZ30rWld475vPcK9s9xTyi3rlA4';

export default function VesselTrackerPage() {
  const [error, setError] = useState<string | null>(null);
  const [host, setHost] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setHost(window.location.host);

    const loadScript = (id: string, src: string) => {
      return new Promise<void>((resolve, reject) => {
        if (document.getElementById(id)) {
          resolve();
          return;
        }
        const script = document.createElement('script');
        script.id = id;
        script.src = src;
        script.async = true;
        script.referrerPolicy = 'no-referrer-when-downgrade';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Erreur chargement script: ${src}`));
        document.head.appendChild(script);
      });
    };

    const init = async () => {
      try {
        // 1. Charger Leaflet
        await loadScript('leaflet-js', 'https://unpkg.com/leaflet@1.4.0/dist/leaflet.js');
        
        // 2. Injecter la clé globale
        (window as any).W = { apiKey: MAP_KEY };

        // 3. Charger libBoot
        await loadScript('windy-lib-boot', 'https://api.windy.com/assets/map-forecast/libBoot.js');

        if (!(window as any).windyInit) return;

        (window as any).windyInit({
          key: MAP_KEY,
          lat: -21.3,
          lon: 165.5,
          zoom: 7,
        }, (windyAPI: any) => {
          if (!windyAPI) {
            setError("401 Unauthorized - Authentification Windy échouée.");
            return;
          }
          console.log("Windy est prêt !");
        });
      } catch (e: any) {
        setError(e.message);
      }
    };

    init();
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-black uppercase tracking-tighter">Test Carte Windy</h1>
        <p className="text-xs font-bold text-muted-foreground uppercase">Mode Debug Minimal</p>
      </div>

      {error && (
        <div className="p-5 bg-red-50 border-2 border-red-200 rounded-2xl space-y-3">
          <p className="font-black text-red-600 text-sm uppercase">Erreur d'accès (401)</p>
          <p className="text-xs font-medium text-red-800 leading-relaxed">
            La clé Windy n'autorise pas cet hôte. Copiez l'hôte ci-dessous et ajoutez-le dans votre console Windy.com (clé 1gGm...).
          </p>
          <div className="p-3 bg-white border-2 rounded-xl font-mono text-sm font-black select-all">
            {host}
          </div>
        </div>
      )}

      <div 
        id="windy" 
        className="w-full h-[500px] bg-slate-100 rounded-[2rem] border-2 shadow-xl overflow-hidden"
      ></div>
      
      <p className="text-[10px] font-bold text-muted-foreground text-center uppercase tracking-widest">
        Initialisation automatique • Clé 1gGm...
      </p>
    </div>
  );
}
