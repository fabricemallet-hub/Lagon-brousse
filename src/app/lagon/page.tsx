'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getTodaysData } from '@/lib/data';
import {
  Waves,
  Wind,
  Sunrise,
  Sunset,
  Moon,
  Thermometer,
  Gauge,
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { FishingPredictor } from '@/components/lagon/fishing-predictor';
import { Progress } from '@/components/ui/progress';
import { useLocation } from '@/context/location-context';

export default function LagonPage() {
  const { selectedLocation } = useLocation();
  const { weather, tides } = getTodaysData(selectedLocation);

  const currentStrength = {
    'Faible': 20,
    'Modéré': 50,
    'Fort': 85,
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Conditions en Mer</CardTitle>
            <CardDescription>
              Informations détaillées sur la météo et la mer pour {selectedLocation}.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Wind className="text-primary" /> Vent
              </h3>
              <p className="text-2xl font-bold">
                {weather.wind.speed}{' '}
                <span className="text-lg font-medium">nœuds</span>
              </p>
              <p className="text-muted-foreground">Direction {weather.wind.direction}</p>
            </div>
            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Waves className="text-primary" /> Houle
              </h3>
              <div className="flex flex-col gap-2">
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
                  <span className="font-mono font-medium">{tide.time} ({tide.height.toFixed(1)}m)</span>
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

      <div className="lg:col-span-1">
        <FishingPredictor />
      </div>
    </div>
  );
}
