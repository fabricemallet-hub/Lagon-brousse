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
  Wind,
  Sunrise,
  Sunset,
  Spade,
  Moon,
} from 'lucide-react';
import { useLocation } from '@/context/location-context';
import { useDate } from '@/context/date-context';

export default function Home() {
  const { selectedLocation } = useLocation();
  const { selectedDate } = useDate();
  const { weather, tides, farming } = getDataForDate(selectedLocation, selectedDate);
  
  const dateString = selectedDate.toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
  });

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Bonjour!
        </h1>
        <p className="text-muted-foreground">
          Voici le résumé pour {selectedLocation} du <span className="font-semibold">{dateString}</span>.
        </p>
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wind className="size-5 text-primary" />
              Météo du jour
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Vent</span>
              <span className="font-medium">
                {weather.wind[0].speed} nœuds ({weather.wind[0].direction})
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Houle (lagon)</span>
              <span className="font-medium">{weather.swell.inside}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Houle (extérieur)</span>
              <span className="font-medium">{weather.swell.outside}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
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
            <CardTitle className="flex items-center gap-2">
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
              <span className="text-muted-foreground">Aujourd'hui est un bon jour pour :</span>
              <span className="font-medium">{farming.recommendation}</span>
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-1 md:col-span-2 lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sunrise className="size-5 text-primary" />
              Éphéméride
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="flex items-center gap-2">
              <Sunrise className="size-6 text-accent" />
              <div>
                <p className="text-sm text-muted-foreground">Lever du soleil</p>
                <p className="font-medium">{weather.sun.sunrise}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Sunset className="size-6 text-accent" />
              <div>
                <p className="text-sm text-muted-foreground">Coucher du soleil</p>
                <p className="font-medium">{weather.sun.sunset}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Moon className="size-6 text-blue-300" />
              <div>
                <p className="text-sm text-muted-foreground">Lever de lune</p>
                <p className="font-medium">{weather.moon.moonrise}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Moon className="size-6 text-slate-400" />
              <div>
                <p className="text-sm text-muted-foreground">Coucher de lune</p>
                <p className="font-medium">{weather.moon.moonset}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
