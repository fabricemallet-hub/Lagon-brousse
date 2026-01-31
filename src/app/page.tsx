'use client';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getDataForDate } from '@/lib/data';
import {
  Waves,
  Moon,
  Spade,
} from 'lucide-react';
import { useLocation } from '@/context/location-context';
import { useDate } from '@/context/date-context';
import { WeatherForecast } from '@/components/ui/weather-forecast';

export default function Home() {
  const { selectedLocation } = useLocation();
  const { selectedDate } = useDate();
  const { weather, tides, farming } = getDataForDate(
    selectedLocation,
    selectedDate
  );

  const dateString = selectedDate.toLocaleDateString('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Bonjour!</h1>
        <p className="text-muted-foreground">
          Voici le résumé pour {selectedLocation} du{' '}
          <span className="font-semibold">{dateString}</span>.
        </p>
      </div>

      <WeatherForecast weather={weather} />

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl md:text-2xl">
              <Waves className="size-5 text-primary" />
              Marées
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {tides.map((tide, index) => (
              <div key={index} className="flex justify-between">
                <span className="text-muted-foreground capitalize">
                  Marée {tide.type}
                </span>
                <span className="font-medium">{tide.time}</span>
              </div>
            ))}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Courant</span>
              <span className="font-medium">{tides[0].current}</span>
            </div>
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
