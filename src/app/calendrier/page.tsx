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
            Sélectionnez une date pour mettre à jour les informations sur les
            autres pages.
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
