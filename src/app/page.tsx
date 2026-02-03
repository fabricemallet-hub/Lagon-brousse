'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getDataForDate, LocationData } from '@/lib/data';
import {
  Waves,
  Moon,
  Spade,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { useLocation } from '@/context/location-context';
import { useDate } from '@/context/date-context';
import { WeatherForecast } from '@/components/ui/weather-forecast';
import { cn } from '@/lib/utils';
import { useMemo, useState, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { MeteoLive } from '@/lib/types';

function HomeSkeleton() {
  return (
    <div className="flex flex-col gap-6 w-full max-w-full">
      <div className="px-1">
        <Skeleton className="h-8 w-32 mb-2" />
        <Skeleton className="h-4 w-full max-w-xs" />
      </div>
      <Skeleton className="h-[300px] w-full" />
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}

// Helper: Calculate progressive UV factor based on time of day (Zenith at 12:00, 0 before 6:00 and after 18:00)
const getProgressiveUV = (maxUV: number, date: Date): number => {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const currentTimeInHours = hours + minutes / 60;

  if (currentTimeInHours < 6 || currentTimeInHours > 18) return 0;

  // Simple bell curve (sinusoidal) peaking at 12:00
  const factor = Math.sin(((currentTimeInHours - 6) / 12) * Math.PI);
  return parseFloat((maxUV * factor).toFixed(1));
};

export default function Home() {
  const { selectedLocation } = useLocation();
  const { selectedDate } = useDate();
  const firestore = useFirestore();
  
  const [data, setData] = useState<LocationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [now, setNow] = useState(new Date());

  // Update time for real-time UV changes
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Récupération des données Météo Live en temps réel depuis Firestore
  const meteoRef = useMemoFirebase(() => {
    if (!firestore || !selectedLocation) return null;
    return doc(firestore, 'meteo_caledonie', selectedLocation);
  }, [firestore, selectedLocation]);
  
  const { data: liveMeteo } = useDoc<MeteoLive>(meteoRef);

  useEffect(() => {
    setIsLoading(true);
    const fetchedData = getDataForDate(selectedLocation, selectedDate);
    setData(fetchedData);
    setIsLocationLoading(false);
    setIsLoading(false);
  }, [selectedLocation, selectedDate]);

  const dateString = selectedDate.toLocaleDateString('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const sortedTides = useMemo(() => {
    if (!data) return [];
    const timeToMinutes = (time: string) => {
        const [hours, minutes] = time.split(':').map(Number);
        return hours * 60 + minutes;
    };
    return [...data.tides].sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
  }, [data]);

  // Fusion des données Live dans l'objet météo procédural pour l'affichage
  const weatherWithLiveUpdates = useMemo(() => {
    if (!data?.weather) return null;
    
    // On n'applique le Live que si on regarde la date d'aujourd'hui
    const isToday = now.toDateString() === selectedDate.toDateString();
    if (!liveMeteo || !isToday) return data.weather;

    const currentHour = now.getHours();
    
    // Correction intelligence UV progressive
    const effectiveUV = getProgressiveUV(liveMeteo.uv, now);
    
    return {
      ...data.weather,
      temp: liveMeteo.temperature,
      uvIndex: effectiveUV,
      hourly: data.weather.hourly.map(f => {
        // On met à jour l'entrée de l'heure actuelle avec les données réelles de Firestore
        if (new Date(f.date).getHours() === currentHour) {
          return {
            ...f,
            temp: liveMeteo.temperature,
            uvIndex: effectiveUV,
            windSpeed: liveMeteo.vent
          };
        }
        return f;
      })
    };
  }, [data, liveMeteo, selectedDate, now]);

  if (isLoading || !data || !weatherWithLiveUpdates) {
    return <HomeSkeleton />;
  }

  const { farming, tideStation } = data;

  return (
    <div className="flex flex-col gap-6 w-full max-w-full overflow-x-hidden">
      <div className="px-1">
        <h1 className="text-2xl font-black tracking-tight">Bonjour!</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Résumé pour <span className="font-bold text-primary">{selectedLocation}</span> le {dateString}.
        </p>
      </div>

      <WeatherForecast weather={weatherWithLiveUpdates} tides={sortedTides} />

      <div className="flex flex-col gap-6 w-full">
        <Card className="w-full">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Waves className="size-5 text-primary" />
              Prochaines Marées
            </CardTitle>
            <CardDescription className="text-xs">
              Station de {tideStation}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-2">
            {sortedTides.map((tide, index) => {
              const TideIcon = tide.type === 'haute' ? TrendingUp : TrendingDown;
              return (
              <div key={index} className={cn(
                  "flex items-center justify-between rounded-lg p-3 border h-14",
                  tide.type === 'haute' && "border-primary/30 bg-primary/5 text-primary",
                  tide.type === 'basse' && "border-destructive/30 bg-destructive/5 text-destructive",
                )}>
                <div className="flex items-center gap-3">
                    <TideIcon className="size-5 shrink-0" />
                    <div>
                      <span className="font-black uppercase text-[10px]">{`Marée ${tide.type}`}</span>
                      <p className="text-sm font-black leading-none">{tide.time}</p>
                    </div>
                </div>
                <span className="font-black text-lg">
                  {tide.height.toFixed(2)}m
                </span>
              </div>
            )})}
          </CardContent>
        </Card>

        <Card className="w-full border-l-4 border-l-accent">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Spade className="size-5 text-accent" />
              Conseil Jardinier
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <span className="text-[10px] font-black uppercase text-muted-foreground">Phase Lunaire</span>
              <span className="font-bold text-sm flex items-center gap-2 bg-card px-2 py-1 rounded shadow-sm border">
                <Moon className="size-4 text-primary" /> {farming.lunarPhase}
              </span>
            </div>
            <div className="p-3 bg-accent/5 border border-accent/10 rounded-lg">
              <span className="text-[10px] font-black uppercase text-accent leading-none block mb-1">
                Idéal aujourd'hui :
              </span>
              <span className="font-bold text-sm leading-snug block">{farming.recommendation}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
