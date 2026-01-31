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
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Calendrier Lunaire</CardTitle>
          <CardDescription>
            Utilisez le bouton en haut de page pour basculer entre la vue Pêche et Champs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LunarCalendar />
        </CardContent>
      </Card>
    </div>
  );
}
