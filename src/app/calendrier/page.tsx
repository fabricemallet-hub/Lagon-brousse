'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { LunarCalendar } from '@/components/ui/lunar-calendar';

export default function CalendrierPage() {
  return (
    <div className="space-y-6 w-full">
      <Card className="w-full overflow-visible border-none shadow-none bg-transparent">
        <CardHeader className="px-1">
          <CardTitle>Calendrier Lunaire</CardTitle>
          <CardDescription>
            Utilisez le bouton en haut de page pour basculer entre la vue Pêche et Champs. 
            Défilez horizontalement sur le calendrier pour voir tout le mois.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 sm:p-6 overflow-visible">
          <LunarCalendar />
        </CardContent>
      </Card>
    </div>
  );
}
