'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
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
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

// Import dynamique du carnet de pêche
const FishingLogCard = dynamic(() => import('@/components/ui/fishing-log-card').then(mod => mod.FishingLogCard), { 
  ssr: false,
  loading: () => <Skeleton className="h-64 w-full" />
});

function PecheSkeleton() {
  return (
     <div className="space-y-6 w-full max-w-full">
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-44 w-full" />
      <div className="space-y-6">
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
    <div className="w-full max-w-full overflow-x-hidden space-y-6 pb-8">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-xl sm:text-2xl">Prévisions de Pêche à la Ligne</CardTitle>
          <CardDescription>
            Meilleurs moments et espèces à cibler pour la pêche à {selectedLocation} le {dateString}.
          </CardDescription>
        </CardHeader>
      </Card>
      
      {pelagicInfo && pelagicInfo.inSeason && (
        <Alert className="w-full">
          <Star className="h-4 w-4" />
          <AlertTitle>Saison des Pélagiques Ouverte !</AlertTitle>
          <AlertDescription>{pelagicInfo.message}</AlertDescription>
        </Alert>
      )}

      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-lg">Autres Captures</CardTitle>
          <CardDescription>
            Prévisions basées sur le cycle lunaire pour le {dateString}.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="flex items-start gap-4 p-2 rounded-lg bg-muted/30">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-semibold text-sm sm:text-base">Crabe de palétuvier</h4>
                <Badge variant={crabAndLobster.crabStatus === 'Plein' ? 'default' : crabAndLobster.crabStatus === 'Mout' ? 'destructive' : 'secondary'}>
                  {crabAndLobster.crabStatus}
                </Badge>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground">{crabAndLobster.crabMessage}</p>
            </div>
          </div>
          <div className="flex items-start gap-4 p-2 rounded-lg bg-muted/30">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-semibold text-sm sm:text-base">Langouste</h4>
                  <Badge variant={crabAndLobster.lobsterActivity === 'Élevée' ? 'default' : 'secondary'}>
                  {crabAndLobster.lobsterActivity}
                </Badge>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground">{crabAndLobster.lobsterMessage}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-6 w-full">
        {fishing.map((slot, index) => (
          <Card key={index} className="w-full">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <Clock className="h-5 w-5" />
                {slot.timeOfDay}
              </CardTitle>
              <div className="text-xs sm:text-sm text-muted-foreground flex flex-wrap items-center gap-3 pt-1">
                  <div className="flex items-center gap-1">
                    <Waves className="h-4 w-4" />
                    <span>{slot.tide} à {slot.tideTime}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {slot.tideMovement === 'étale' ? (
                      <Badge variant={slot.tide.includes('haute') ? 'default' : 'destructive'} className="capitalize text-[10px] font-semibold">
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
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <Fish className="h-5 w-5 text-primary" />
                Potentiel par espèce
              </h4>
              <Accordion type="single" collapsible className="w-full space-y-3">
                {/* Seuil relevé à 8/10 pour n'afficher que les meilleures opportunités */}
                {slot.fish.filter(f => f.rating >= 8).map((f, i) => (
                  <AccordionItem value={`item-${i}`} key={i} className="border-none">
                    <div className="border rounded-lg overflow-hidden bg-card shadow-sm">
                      <AccordionTrigger className="p-4 hover:no-underline text-sm [&[data-state=open]]:bg-muted/50 [&[data-state=open]]:border-b">
                        <div className="flex justify-between items-center w-full">
                          <div className="flex flex-col items-start gap-1 text-left">
                            <span className="font-bold">{f.name}</span>
                            {f.location && <Badge variant={f.location === 'Large' ? 'destructive' : 'secondary'} className="text-[10px] h-4 px-1.5 font-semibold">{f.location}</Badge>}
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <RatingStars rating={f.rating} />
                            <span className="text-[10px] font-mono text-muted-foreground font-bold">{f.rating}/10</span>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="p-4 text-xs sm:text-sm bg-muted/20">
                        <ul className="space-y-3 text-muted-foreground">
                          <li className="flex flex-col gap-1">
                            <strong className="font-bold text-card-foreground/90 uppercase text-[10px]">Activité:</strong>
                            <span className="leading-relaxed">{f.advice.activity}</span>
                          </li>
                          <li className="flex flex-col gap-1">
                            <strong className="font-bold text-card-foreground/90 uppercase text-[10px]">Alimentation:</strong>
                            <span className="leading-relaxed">{f.advice.feeding}</span>
                          </li>
                          <li className="flex flex-col gap-1">
                            <strong className="font-bold text-card-foreground/90 uppercase text-[10px]">Spot idéal:</strong>
                            <span className="leading-relaxed">{f.advice.location_specific}</span>
                          </li>
                          <li className="flex flex-col gap-1">
                            <strong className="font-bold text-card-foreground/90 uppercase text-[10px]">Profondeur:</strong>
                            <span className="leading-relaxed font-semibold text-primary">{f.advice.depth}</span>
                          </li>
                        </ul>
                      </AccordionContent>
                    </div>
                  </AccordionItem>
                ))}
                {slot.fish.filter(f => f.rating >= 8).length === 0 && (
                  <p className="text-center text-xs text-muted-foreground py-4 italic">Peu d'activité majeure prévue sur ce créneau.</p>
                )}
              </Accordion>
            </CardContent>
          </Card>
        ))}
      </div>
      
      <div className="w-full">
        <FishingLogCard data={data} />
      </div>
    </div>
  );
}
