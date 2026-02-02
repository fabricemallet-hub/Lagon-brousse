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
  Wind,
  Sunrise,
  Sunset,
  Moon,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useLocation } from '@/context/location-context';
import { useDate } from '@/context/date-context';
import { cn } from '@/lib/utils';
import { useMemo, useState, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

function LagonSkeleton() {
  return (
     <div className="space-y-6">
      <Skeleton className="h-28 w-full" />
      <div className="grid gap-6 md:grid-cols-2">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
      <Skeleton className="h-80 w-full" />
    </div>
  )
}

export default function LagonPage() {
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
  
  const dateString = selectedDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });

  const sortedTides = useMemo(() => {
    if (!data) return [];
    const timeToMinutes = (time: string) => {
        const [hours, minutes] = time.split(':').map(Number);
        return hours * 60 + minutes;
    };
    return [...data.tides].sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
  }, [data]);

  if (isLoading || !data) {
    return <LagonSkeleton />;
  }

  const { weather, tideStation } = data;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Conditions en Mer</CardTitle>
          <CardDescription>
            Informations détaillées sur la météo et la mer pour {selectedLocation} le {dateString}.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4 rounded-lg border p-4 bg-card">
            <h3 className="font-semibold flex items-center gap-2 mb-2">
              <Wind className="text-primary" /> Vent
            </h3>
            <div className="space-y-3">
              {weather.wind.map((forecast, index) => (
                <div key={index} className="flex justify-between items-center border-b pb-2 last:border-b-0">
                    <div>
                        <p className="font-bold">{forecast.time}</p>
                        <p className="text-sm text-muted-foreground">{forecast.stability}</p>
                    </div>
                    <div className="text-right">
                        <p className="font-semibold">{forecast.speed} nœuds</p>
                        <p className="text-sm text-muted-foreground">{forecast.direction}</p>
                    </div>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-4 rounded-lg border p-4 bg-card">
            <h3 className="font-semibold flex items-center gap-2 mb-2">
              <Waves className="text-primary" /> Houle
            </h3>
            <div className="flex flex-col gap-4">
              <div>
                <p className="font-bold text-xl">{weather.swell.inside}</p>
                <p className="text-sm text-muted-foreground">
                  Dans le lagon
                </p>
              </div>
              <div>
                <p className="font-bold text-xl">{weather.swell.outside}</p>
                <p className="text-sm text-muted-foreground">
                  À l'extérieur du récif
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                Période de {weather.swell.period} secondes
              </p>
            </div>
          </div>
        </CardContent>
        <CardContent>
          <Separator className="my-4" />
          <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                  <Sunrise className="size-5 text-accent" />
                  <span>Lever soleil: {weather.sun.sunrise}</span>
              </div>
              <div className="flex items-center gap-2">
                  <Sunset className="size-5 text-accent" />
                  <span>Coucher soleil: {weather.sun.sunset}</span>
              </div>
              <div className="flex items-center gap-2">
                  <Moon className="size-5 text-blue-300" />
                  <span>Lever lune: {weather.moon.moonrise}</span>
              </div>
              <div className="flex items-center gap-2">
                  <Moon className="size-5 text-slate-400" />
                  <span>Coucher lune: {weather.moon.moonset}</span>
              </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Marées et Courants</CardTitle>
          <CardDescription>
            Données de marée basées sur la station de {tideStation}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            {sortedTides.map((tide, i) => {
              const TideIcon = tide.type === 'haute' ? TrendingUp : TrendingDown;
              
              return (
                  <div key={i} className={cn(
                      "flex items-center justify-between p-3 rounded-lg border bg-background transition-all",
                      tide.type === 'haute' && "border-primary/50 bg-primary/10",
                      tide.type === 'basse' && "border-destructive/50 bg-destructive/10",
                  )}>
                      <div className="flex items-center gap-4">
                          <TideIcon className={cn(
                              "size-8 shrink-0",
                              tide.type === 'haute' ? 'text-primary' : 'text-destructive',
                          )} />
                          <div>
                              <p className="font-semibold text-lg capitalize">{`Marée ${tide.type}`}</p>
                              <div className="flex items-center gap-2">
                                <p className="text-muted-foreground font-mono">{tide.time}</p>
                                <Badge variant={tide.type === 'haute' ? 'default' : 'destructive'} className="text-xs capitalize">{tide.type === 'haute' ? 'Pleine Mer' : 'Basse Mer'}</Badge>
                              </div>
                          </div>
                      </div>
                      <div className={cn(
                          "font-bold text-xl",
                          tide.type === 'haute' && "text-primary",
                          tide.type === 'basse' && "text-destructive",
                      )}>
                          {tide.height.toFixed(2)}m
                      </div>
                  </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
