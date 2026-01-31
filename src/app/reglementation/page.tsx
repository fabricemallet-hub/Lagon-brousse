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
import { Ban, Check, Scale, BookOpen } from 'lucide-react';

const calendarData = [
  {
    name: 'Picot',
    forbidden: [8, 9, 10, 11, 0], // Sep, Oct, Nov, Dec, Jan
    details: 'Interdiction du 1er septembre au 31 janvier.',
  },
  {
    name: 'Crabe de palétuvier',
    forbidden: [11, 0], // Dec, Jan
    details: 'Interdiction du 1er décembre au 31 janvier.',
  },
  {
    name: 'Huître de palétuvier',
    forbidden: [8, 9, 10, 11, 0, 1, 2, 3], // Sep to Apr
    details: 'Interdiction du 1er septembre au 30 avril.',
  },
];

const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];


export default function ReglementationPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Réglementation de la Pêche</CardTitle>
          <CardDescription>
            Résumé des principales règles de pêche de loisir en Province Sud.
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
          <CardDescription>
            Périodes d'interdiction pour certaines espèces clés.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {calendarData.map((item) => (
            <div key={item.name}>
              <h4 className="font-semibold text-lg mb-2">{item.name}</h4>
              <div className="grid grid-cols-12 gap-1">
                {months.map((month, index) => (
                  <div
                    key={month}
                    className={`flex flex-col items-center justify-center p-2 rounded-md h-16 text-center ${
                      item.forbidden.includes(index)
                        ? 'bg-destructive/10 text-destructive'
                        : 'bg-green-600/10 text-green-800'
                    }`}
                  >
                    <span className="text-xs font-bold">{month}</span>
                    {item.forbidden.includes(index) ? (
                      <Ban className="h-5 w-5 mt-1" />
                    ) : (
                      <Check className="h-5 w-5 mt-1 text-green-600" />
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
            Autres Réglementations
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
                    <strong>Huître:</strong> Taille &gt; 6 cm, limité à 10
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
