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
  Phone,
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
  const firestore = useFirestore();
  const [data, setData] = useState<LocationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!firestore) return;
    async function fetchData() {
      setIsLoading(true);
      const fetchedData = await getDataForDate(firestore, selectedLocation, selectedDate);
      setData(fetchedData);
      setIsLoading(false);
    }
    fetchData();
  }, [firestore, selectedLocation, selectedDate]);
  
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
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div>
                  <p className="font-bold text-lg">{forecast.time}</p>
                  <p className="text-muted-foreground">{forecast.stability}</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold">{forecast.speed} nœuds</p>
                  <p className="text-muted-foreground">{forecast.direction}</p>
                </div>
                <WindMap direction={forecast.direction} className="w-16 h-24" />
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="size-5 text-primary" />
            Zones de Chasse Autorisées
          </CardTitle>
          <CardDescription>
            Liste non-exhaustive de zones de chasse. Contactez toujours les
            responsables avant de vous y rendre.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger>Domaine de Deva (Bourail)</AccordionTrigger>
              <AccordionContent className="space-y-2">
                <div className="flex items-center gap-2">
                  <Phone className="size-4" />
                  <span>Contact : SEM Mwe Ara - Tél : 46.57.57</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Chasse réglementée au cerf et cochon sauvage sur un vaste
                  domaine. La réservation est obligatoire. Des guides peuvent
                  être disponibles.
                </p>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2">
              <AccordionTrigger>Forêt de la Thy (Yaté)</AccordionTrigger>
              <AccordionContent className="space-y-2">
                <div className="flex items-center gap-2">
                  <Phone className="size-4" />
                  <span>
                    Contact : Province Sud, Direction de l'Environnement - Tél :
                    20.34.00
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Zone de chasse publique. Le permis de chasse de la Province Sud
                  est obligatoire. Se renseigner sur les dates d'ouverture et
                  les secteurs autorisés.
                </p>
              </AccordionContent>
            </AccordionItem>
             <AccordionItem value="item-3">
              <AccordionTrigger>Parc des Grandes Fougères (Farino)</AccordionTrigger>
              <AccordionContent className="space-y-2">
                <div className="flex items-center gap-2">
                  <Phone className="size-4" />
                  <span>
                    Contact : Maison du Parc (Tél : 44.35.00) ou Province Sud
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  La chasse y est très encadrée et vise à réguler les populations de cerfs et cochons. Elle n'est autorisée que lors de battues organisées à des dates spécifiques. Il est impératif de se renseigner auprès de la Maison du Parc pour connaître le calendrier et les modalités.
                </p>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-4">
              <AccordionTrigger>Plaine des Gaïacs (Koné)</AccordionTrigger>
              <AccordionContent className="space-y-2">
                <div className="flex items-center gap-2">
                  <Phone className="size-4" />
                  <span>Contact : Province Nord, Service de l'environnement</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Grande zone de chasse publique en Province Nord. Le permis de
                  chasse provincial est requis. Renseignez-vous sur les
                  réglementations spécifiques.
                </p>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-5">
              <AccordionTrigger>
                Chasses privées (La Foa, Boulouparis...)
              </AccordionTrigger>
              <AccordionContent className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  De nombreuses propriétés privées proposent des week-ends de
                  chasse. Les contacts se trouvent souvent via les réseaux
                  sociaux (groupes de chasseurs) ou le bouche-à-oreille.
                  Exemple: "Chasse en Calédonie" sur les réseaux sociaux. Soyez
                  respectueux des propriétés.
                </p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}
