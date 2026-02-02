'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getDataForDate, LocationData } from '@/lib/data';
import { useLocation } from '@/context/location-context';
import { useDate } from '@/context/date-context';
import { Clock, Waves, TrendingUp, TrendingDown, Fish, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CrabIcon, LobsterIcon, OctopusIcon } from '@/components/icons';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { FishingLogCard } from '@/components/ui/fishing-log-card';

function PecheSkeleton() {
  return (
     <div className="space-y-6">
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-44 w-full" />
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-2">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  )
}

export default function PechePage() {
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

  const getTideIcon = (movement: 'montante' | 'descendante' | 'étale') => {
    switch (movement) {
      case 'montante':
        return <TrendingUp className="h-4 w-4 text-primary" />;
      case 'descendante':
        return <TrendingDown className="h-4 w-4 text-destructive" />;
      default:
        return null;
    }
  };
  
  const RatingStars = ({ rating }: { rating: number }) => {
    const fullStars = Math.floor(rating / 2);
    const halfStar = rating % 2 === 1;
    const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);
    return (
      <div className="flex items-center">
        {[...Array(fullStars)].map((_, i) => (
          <Star key={`full-${i}`} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
        ))}
        {halfStar && <Star key="half" className="h-4 w-4 fill-yellow-400 text-yellow-400" style={{ clipPath: 'polygon(0 0, 50% 0, 50% 100%, 0 100%)' }} />}
        {[...Array(emptyStars)].map((_, i) => (
          <Star key={`empty-${i}`} className="h-4 w-4 text-gray-300" />
        ))}
      </div>
    );
  };

  if (isLoading || !data) {
    return <PecheSkeleton />;
  }

  const { fishing, pelagicInfo, crabAndLobster } = data;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Prévisions de Pêche à la Ligne</CardTitle>
          <CardDescription>
            Meilleurs moments et espèces à cibler pour la pêche à {selectedLocation} le {dateString}.
          </CardDescription>
        </CardHeader>
      </Card>
      
      {pelagicInfo && pelagicInfo.inSeason && (
        <Alert>
          <Star className="h-4 w-4" />
          <AlertTitle>Saison des Pélagiques Ouverte !</AlertTitle>
          <AlertDescription>{pelagicInfo.message}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Autres Captures</CardTitle>
          <CardDescription>
            Prévisions basées sur le cycle lunaire pour le {dateString}.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-3">
          <div className="flex items-start gap-4">
            <CrabIcon className="h-8 w-8 text-primary mt-1" />
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-semibold">Crabe de palétuvier</h4>
                <Badge variant={crabAndLobster.crabStatus === 'Plein' ? 'default' : crabAndLobster.crabStatus === 'Mout' ? 'destructive' : 'secondary'}>
                  {crabAndLobster.crabStatus}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{crabAndLobster.crabMessage}</p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <LobsterIcon className="h-8 w-8 text-primary mt-1" />
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-semibold">Langouste</h4>
                  <Badge variant={crabAndLobster.lobsterActivity === 'Élevée' ? 'default' : 'secondary'}>
                  {crabAndLobster.lobsterActivity}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{crabAndLobster.lobsterMessage}</p>
            </div>
          </div>
           {crabAndLobster.octopusActivity && (
            <div className="flex items-start gap-4">
              <OctopusIcon className="h-8 w-8 text-primary mt-1" />
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold">Poulpe</h4>
                    <Badge variant={crabAndLobster.octopusActivity === 'Élevée' ? 'default' : crabAndLobster.octopusActivity === 'Moyenne' ? 'secondary' : 'outline'}>
                    {crabAndLobster.octopusActivity}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{crabAndLobster.octopusMessage}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-2">
        {fishing.map((slot, index) => (
          <Card key={index}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Clock className="h-5 w-5" />
                {slot.timeOfDay}
              </CardTitle>
              <div className="text-sm text-muted-foreground flex items-center gap-4 pt-1">
                  <div className="flex items-center gap-1">
                    <Waves className="h-4 w-4" />
                    <span>{slot.tide} à {slot.tideTime}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {slot.tideMovement === 'étale' ? (
                      <Badge variant={slot.tide.includes('haute') ? 'default' : 'destructive'} className="capitalize text-xs font-semibold">
                          {slot.tide.includes('haute') ? 'Pleine Mer' : 'Basse Mer'}
                      </Badge>
                    ) : (
                      <>
                        {getTideIcon(slot.tideMovement)}
                        <span className={cn("capitalize font-semibold", slot.tideMovement === 'montante' ? 'text-primary' : 'text-destructive')}>
                          {slot.tideMovement}
                        </span>
                      </>
                    )}
                  </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <h4 className="font-semibold flex items-center gap-2">
                <Fish className="h-5 w-5 text-primary" />
                Potentiel par espèce
              </h4>
              <Accordion type="single" collapsible className="w-full space-y-2">
                {slot.fish.filter(f => f.rating >= 9).map((f, i) => (
                  <AccordionItem value={`item-${i}`} key={i} className="border-b-0">
                    <div className="border rounded-lg overflow-hidden bg-card">
                      <AccordionTrigger className="p-3 hover:no-underline text-sm [&[data-state=open]]:bg-muted/50 [&[data-state=open]]:border-b">
                        <div className="flex justify-between items-center w-full">
                          <div className="flex items-center gap-2 text-left">
                            <span className="font-medium">{f.name}</span>
                            {f.location && <Badge variant={f.location === 'Large' ? 'destructive' : 'secondary'} className="text-xs font-semibold">{f.location}</Badge>}
                          </div>
                          <div className="flex items-center gap-2">
                            <RatingStars rating={f.rating} />
                            <Badge variant="outline" className="w-12 justify-center">{f.rating}/10</Badge>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="p-3 text-sm bg-muted/50">
                        <ul className="space-y-2 text-muted-foreground">
                          <li className="flex items-start gap-2">
                            <strong className="w-24 shrink-0 font-semibold text-card-foreground/80">Activité:</strong>
                            <span>{f.advice.activity}</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <strong className="w-24 shrink-0 font-semibold text-card-foreground/80">Alimentation:</strong>
                            <span>{f.advice.feeding}</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <strong className="w-24 shrink-0 font-semibold text-card-foreground/80">Spot:</strong>
                            <span>{f.advice.location_specific}</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <strong className="w-24 shrink-0 font-semibold text-card-foreground/80">Profondeur:</strong>
                            <span>{f.advice.depth}</span>
                          </li>
                        </ul>
                      </AccordionContent>
                    </div>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        ))}
      </div>
      <FishingLogCard data={data} />
    </div>
  );
}
