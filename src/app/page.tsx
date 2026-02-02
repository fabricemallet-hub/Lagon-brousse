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

function HomeSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <Skeleton className="h-9 w-48 mb-2" />
        <Skeleton className="h-5 w-full max-w-sm" />
      </div>
      <Skeleton className="h-[420px] w-full" />
      <div className="grid gap-6 md:grid-cols-2">
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-56 w-full" />
      </div>
    </div>
  );
}

export default function Home() {
  const { selectedLocation } = useLocation();
  const { selectedDate } = useDate();
  const [data, setData] = useState<LocationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    const fetchedData = getDataForDate(selectedLocation, selectedDate);
    setData(fetchedData);
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

  if (isLoading || !data) {
    return <HomeSkeleton />;
  }

  const { weather, farming, tideStation } = data;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Bonjour!</h1>
        <p className="text-muted-foreground">
          Voici le résumé pour {selectedLocation} du{' '}
          <span className="font-semibold">{dateString}</span>.
        </p>
      </div>

      <WeatherForecast weather={weather} tides={sortedTides} />

      <div className="grid gap-6 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl md:text-2xl">
              <Waves className="size-5 text-primary" />
              Marées
            </CardTitle>
            <CardDescription>
              Données de marée de la station de {tideStation}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {sortedTides.map((tide, index) => {
              const TideIcon = tide.type === 'haute' ? TrendingUp : TrendingDown;
              return (
              <div key={index} className={cn(
                  "flex items-center justify-between rounded-md p-3 border",
                  tide.type === 'haute' && "border-primary/50 bg-primary/10 text-primary",
                  tide.type === 'basse' && "border-destructive/50 bg-destructive/10 text-destructive",
                )}>
                <div className="flex items-center gap-3">
                    <TideIcon className="size-6 shrink-0" />
                    <div>
                      <span className="font-semibold capitalize text-base">{`Marée ${tide.type}`}</span>
                      <p className="text-sm font-mono text-current/80">{tide.time}</p>
                    </div>
                </div>
                <span className="font-mono font-bold text-lg">
                  {tide.height.toFixed(2)}m
                </span>
              </div>
            )})}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl md:text-2xl">
              <Spade className="size-5 text-primary" />
              Conseil du Jardinier
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Phase Lunaire</span>
              <span className="font-medium flex items-center gap-2">
                <Moon className="size-4" /> {farming.lunarPhase}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-muted-foreground">
                Aujourd'hui est un bon jour pour :
              </span>
              <span className="font-medium">{farming.recommendation}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
