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
                  "flex items-center justify-between rounded-md p-2 -mx-2 transition-colors",
                  tide.type === 'haute' && "bg-primary/10",
                  tide.type === 'basse' && "bg-destructive/10",
                )}>
                <div className="flex items-center gap-2">
                    <TideIcon className={cn(
                      "size-5 shrink-0",
                      tide.type === 'haute' ? 'text-primary' : 'text-destructive',
                    )} />
                    <span className="text-muted-foreground capitalize text-sm">{`Marée ${tide.type}`}</span>
                </div>
                <span className={cn(
                    "font-mono font-medium text-sm",
                    tide.type === 'haute' && "text-primary font-bold",
                    tide.type === 'basse' && "text-destructive font-bold",
                  )}>
                  {tide.time} ({tide.height.toFixed(2)}m)
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
