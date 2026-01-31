'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Ban, Check, Scale, BookOpen, Crosshair } from 'lucide-react';
import { cn } from '@/lib/utils';

const fishingCalendarData = [
  {
    name: 'Picot',
    forbidden: [8, 9, 10, 11, 0], // Sep, Oct, Nov, Dec, Jan
    details: 'Pêche et vente interdites du 1er septembre au 31 janvier.',
  },
  {
    name: 'Crabe de palétuvier',
    forbidden: [11, 0], // Dec, Jan
    details: 'Pêche et vente interdites du 1er décembre au 31 janvier.',
  },
  {
    name: 'Huître roche ou de palétuvier',
    forbidden: [8, 9, 10, 11, 0, 1, 2, 3], // Sep to Apr
    details: 'Pêche et vente interdites du 1er septembre au 30 avril.',
  },
  {
    name: 'Espèces intégralement protégées',
    forbidden: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    details: 'Interdiction totale de pêche/capture pour : tricot rayé, tortue, dugong, cétacés, requin, napoléon, volute, toutoute, casque, nautile, oiseaux marins.',
  },
  {
    name: 'Corail',
    forbidden: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    details: "Récolte des coraux vivants interdite toute l'année.",
  },
];

const huntingCalendarData = [
  {
    name: 'Notou & Roussette',
    allowed: [3, 4, 5], // Avril, Mai, Juin
    details: 'Chasse autorisée uniquement les samedis et dimanches (quota max 5/jour/chasseur). Vente interdite toute l\'année.',
  },
  {
    name: 'Gibier d\'eau (Canards, Sarcelle)',
    allowed: [6, 7, 8, 9, 10], // Juillet à Novembre
    details: 'Chasse autorisée du 1er juillet au 30 novembre inclus.',
  },
  {
    name: 'Gibier terrestre',
    allowed: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], // Toute l'année
    details: 'Chasse autorisée sans quota. Inclut : Cerf, cochon, lapin, chèvre, faisan, dindon, canard Colvert, poule Sultane.',
  },
];

const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];


export default function ReglementationPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Réglementation</CardTitle>
          <CardDescription>
            Résumé des principales règles de pêche et de chasse de loisir en Province Sud.
            Ce guide ne remplace pas les textes officiels.
          </CardDescription>
        </CardHeader>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen />
            Calendrier des Pêches
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {fishingCalendarData.map((item) => (
            <div key={item.name}>
              <h4 className="font-semibold text-lg mb-2">{item.name}</h4>
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-12 gap-1">
                {months.map((month, index) => (
                  <div
                    key={month}
                    className={cn(
                      'flex flex-col items-center justify-center rounded-md h-16 text-center p-1 sm:p-2',
                      item.forbidden.includes(index)
                        ? 'bg-destructive/10 text-destructive'
                        : 'bg-green-600/10 text-green-800'
                    )}
                  >
                    <span className="text-[10px] sm:text-xs font-bold">{month}</span>
                    {item.forbidden.includes(index) ? (
                      <Ban className="h-4 w-4 sm:h-5 sm:w-5 mt-1" />
                    ) : (
                      <Check className="h-4 w-4 sm:h-5 sm:w-5 mt-1 text-green-600" />
                    )}
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground mt-2">{item.details}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crosshair />
            Calendrier de Chasse
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {huntingCalendarData.map((item) => (
            <div key={item.name}>
              <h4 className="font-semibold text-lg mb-2">{item.name}</h4>
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-12 gap-1">
                {months.map((month, index) => (
                  <div
                    key={month}
                    className={cn(
                      'flex flex-col items-center justify-center rounded-md h-16 text-center p-1 sm:p-2',
                      item.allowed.includes(index)
                        ? 'bg-green-600/10 text-green-800'
                        : 'bg-destructive/10 text-destructive'
                    )}
                  >
                    <span className="text-[10px] sm:text-xs font-bold">{month}</span>
                    {item.allowed.includes(index) ? (
                      <Check className="h-4 w-4 sm:h-5 sm:w-5 mt-1 text-green-600" />
                    ) : (
                      <Ban className="h-4 w-4 sm:h-5 sm:w-5 mt-1" />
                    )}
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground mt-2">{item.details}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale />
            Autres Réglementations (Pêche)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger>Tailles & Quantités</AccordionTrigger>
              <AccordionContent>
                <ul className="list-disc space-y-2 pl-5">
                  <li>
                    <strong>Bénitier:</strong> Limité à 2 par sortie, par
                    bateau/pêcheur.
                  </li>
                  <li>
                    <strong>Troca:</strong> Diamètre de base entre 9 et 12 cm.
                  </li>
                  <li>
                    <strong>Huître roche ou de palétuvier:</strong> Taille &gt; 6 cm, limité à 10
                    douzaines par bateau/sortie.
                  </li>
                  <li>
                    <strong>Crabe de palétuvier:</strong> Les règles
                    d'interdiction ne s'appliquent pas aux crabes de taille
                    inférieure à 14 cm et aux crabes mous.
                  </li>
                </ul>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2">
              <AccordionTrigger>Marquage Obligatoire</AccordionTrigger>
              <AccordionContent>
                <p>
                  <strong>
                    Langoustes, popinées, et cigales de mer (grainées ou non):
                  </strong>{' '}
                  Le marquage de la queue est obligatoire toute l'année.
                </p>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-3">
              <AccordionTrigger>Espèces Strictement Protégées</AccordionTrigger>
              <AccordionContent>
                <p>
                  La pêche, capture, détention, transport, ou commercialisation
                  sont <strong>formellement interdits</strong> pour les espèces
                  suivantes :
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                    {[
                        'Tricot rayé', 'Tortues marines', 'Dugong',
                        'Cétacés', 'Requins', 'Napoléon', 'Volute', 'Toutoute',
                        'Casque', 'Nautile', 'Oiseaux marins', 'Coraux vivants'
                    ].map(species => <Badge key={species} variant="destructive">{species}</Badge>)}
                </div>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-4">
              <AccordionTrigger>Sanctions</AccordionTrigger>
              <AccordionContent>
                <p>
                  Le non-respect de la réglementation expose les contrevenants
                  à des amendes, à la saisie du matériel, des produits de la
                  pêche et du navire.
                </p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}
