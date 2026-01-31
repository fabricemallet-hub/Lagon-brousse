'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getDataForDate } from '@/lib/data';
import {
  Waves,
  Wind,
  Sunrise,
  Sunset,
  Moon,
  Gauge,
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { useLocation } from '@/context/location-context';
import { useDate } from '@/context/date-context';
import { WindMap } from '@/components/ui/wind-map';
import type { WindDirection } from '@/lib/types';

export default function LagonPage() {
  const { selectedLocation } = useLocation();
  const { selectedDate } = useDate();
  const { weather, tides } = getDataForDate(selectedLocation, selectedDate);
  
  const dateString = selectedDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });

  const currentStrength = {
    'Faible': 20,
    'Modéré': 50,
    'Fort': 85,
  }

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
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            {tides.map((tide, i) => (
              <div key={i} className="flex justify-between border-b pb-1">
                <span className="capitalize text-muted-foreground">
                  {tide.type}
                </span>
                <span className="font-mono font-medium">{tide.time} ({tide.height.toFixed(2)}m)</span>
              </div>
            ))}
          </div>
          <Separator />
          <div className="space-y-2">
            <h4 className="font-medium flex items-center gap-2">
              <Gauge className="text-primary" /> Force du Courant
            </h4>
            <Progress value={currentStrength[tides[0].current as keyof typeof currentStrength]} className="h-2" />
            <p className="text-sm text-muted-foreground text-right">{tides[0].current}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
