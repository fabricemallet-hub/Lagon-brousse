'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
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
