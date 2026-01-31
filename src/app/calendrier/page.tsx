'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { useDate } from '@/context/date-context';
import { useLocation } from '@/context/location-context';
import { getDataForDate } from '@/lib/data';
import { Fish, Moon, Waves, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function CalendrierPage() {
  const { selectedDate, setSelectedDate } = useDate();
  const { selectedLocation } = useLocation();

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
    }
  };

  const data = getDataForDate(selectedLocation, selectedDate);
  const isGoodFishingDay = data.fishing.some((slot) =>
    slot.fish.some((f) => f.rating >= 8)
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Calendrier</CardTitle>
          <CardDescription>
            Sélectionnez une date pour voir les prévisions détaillées et mettre à
            jour les informations sur les autres pages.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col lg:flex-row gap-8 items-start">
          <div className="flex-shrink-0">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleDateSelect}
              className="rounded-md border"
              locale-fr
            />
          </div>
          <div className="flex-grow w-full">
            <h3 className="text-xl font-semibold mb-4">
              Prévisions pour le{' '}
              {selectedDate.toLocaleDateString('fr-FR', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </h3>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Waves className="size-5 text-primary" />
                <h4 className="font-semibold">Marées</h4>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {data.tides.map((tide, i) => (
                  <div
                    key={i}
                    className="flex justify-between text-sm border-b pb-1"
                  >
                    <span className="capitalize text-muted-foreground">
                      Marée {tide.type}
                    </span>
                    <span className="font-mono font-medium">
                      {tide.time} ({tide.height.toFixed(1)}m)
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 pt-2">
                <Moon className="size-5 text-primary" />
                <h4 className="font-semibold">Lune</h4>
              </div>
              <p className="text-sm">{data.weather.moon.phase}</p>
              <div className="flex items-center gap-2 pt-2">
                <Fish className="size-5 text-primary" />
                <h4 className="font-semibold">Potentiel de pêche</h4>
              </div>
              <Badge variant={isGoodFishingDay ? 'default' : 'secondary'}>
                {isGoodFishingDay ? 'Bon' : 'Moyen'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Navigation</AlertTitle>
        <AlertDescription>
          Les informations des pages Lagon, Pêche et Champs sont maintenant
          basées sur la date sélectionnée dans ce calendrier.
        </AlertDescription>
      </Alert>
    </div>
  );
}
