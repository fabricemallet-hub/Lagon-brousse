'use client';
import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { getDataForDate, LocationData } from '@/lib/data';
import { useLocation } from '@/context/location-context';
import { useDate } from '@/context/date-context';
import { WindMap } from '@/components/ui/wind-map';
import {
  AlertTriangle,
  Wind,
  Droplets,
  Clock,
  Sunrise,
  Sunset,
  Info,
  MapPin,
} from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { ShootingTableCard } from '@/components/ui/shooting-table-card';
import { Skeleton } from '@/components/ui/skeleton';
import { useFirestore } from '@/firebase';

function ChasseSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-16 w-full" />
      <div className="grid gap-6 md:grid-cols-2">
        <Skeleton className="h-80 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
      <Skeleton className="h-64 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}

export default function ChassePage() {
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
    day: 'numeric',
    month: 'long',
  });

  if (isLoading || !data) {
    return <ChasseSkeleton />;
  }

  const { hunting, weather } = data;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Prévisions de Chasse au Cerf</CardTitle>
          <CardDescription>
            Informations pour la chasse à {selectedLocation} le {dateString}.
          </CardDescription>
        </CardHeader>
      </Card>

      {hunting.period.name === 'Brame' && (
        <Alert className="bg-amber-50 border border-amber-200 text-amber-800 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-200">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertTitle className="font-bold">
            Période de Brame : Activité maximale
          </AlertTitle>
          <AlertDescription>{hunting.period.description}</AlertDescription>
        </Alert>
      )}

      {hunting.period.name === 'Chute des bois' && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>{`Période de ${hunting.period.name}`}</AlertTitle>
          <AlertDescription>{hunting.period.description}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wind className="size-5 text-primary" />
              Prévisions de Vent
            </CardTitle>
            <CardDescription>
              Force et direction du vent au cours de la journée.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {weather.wind.map((forecast, index) => (
              <div
                key={index}
                className="flex items-center justify-between rounded-lg border p-3 gap-3"
              >
                <div className='flex-1'>
                  <p className="font-bold text-lg">{forecast.time}</p>
                  <p className="text-xl font-bold">{forecast.speed} nœuds</p>
                  <p className="text-sm text-muted-foreground">{forecast.direction} - {forecast.stability}</p>
                </div>
                <WindMap direction={forecast.direction} className="w-20 h-24" />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="size-5 text-primary" />
              Conseils, Météo & Horaires
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2 rounded-lg border p-4 bg-card">
              <h3 className="font-semibold flex items-center gap-2 mb-2">
                <Droplets className="text-primary" /> Pluie
              </h3>
              <p className="text-xl font-bold">{weather.rain}</p>
              <p className="text-sm text-muted-foreground">
                {hunting.advice.rain}
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold">Gestion des Odeurs</h3>
              <p className="text-sm text-muted-foreground">
                {hunting.advice.scent}
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold">Meilleures Heures</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Sunrise className="size-5 text-accent" />
                  <span>Aube: {weather.sun.sunrise}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Sunset className="size-5 text-accent" />
                  <span>Crépuscule: {weather.sun.sunset}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      <ShootingTableCard />
    </div>
  );
}
