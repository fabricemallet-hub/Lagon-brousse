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
import { semisData, type Vegetable } from '@/lib/semis-data';
import {
  Sun,
  Droplets,
  Flower,
  Bug,
  BookHeart,
  Calendar,
  Wheat,
  MapPin,
  BookText,
} from 'lucide-react';

function AdviceDetail({
  icon: Icon,
  title,
  content,
}: {
  icon: React.ElementType;
  title: string;
  content: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="size-5 text-primary mt-1 flex-shrink-0" />
      <div>
        <h4 className="font-semibold">{title}</h4>
        <p className="text-sm text-muted-foreground">{content}</p>
      </div>
    </div>
  );
}

export default function SemisPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Guide de Culture des Légumes</CardTitle>
          <CardDescription>
            Calendrier des semis et conseils de culture pour la Nouvelle-Calédonie.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            {semisData.map((veg) => (
              <AccordionItem value={veg.name} key={veg.name}>
                <AccordionTrigger className="text-lg hover:no-underline">
                  <div className="flex items-center gap-4">
                    <span className="text-2xl">{veg.icon}</span>
                    <span>{veg.name}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-6 pt-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-4 rounded-lg bg-muted/50">
                    <div className="flex items-start gap-3">
                      <Calendar className="size-5 text-accent mt-1" />
                      <div>
                        <h4 className="font-semibold">Périodes de Semis</h4>
                        <ul className="text-sm text-muted-foreground list-disc pl-5">
                          <li>
                            <span className="font-medium">Saison chaude:</span>{' '}
                            {veg.sowingSeasonWarm}
                          </li>
                          <li>
                            <span className="font-medium">Saison fraîche:</span>{' '}
                            {veg.sowingSeasonCool}
                          </li>
                        </ul>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Wheat className="size-5 text-accent mt-1" />
                       <div>
                        <h4 className="font-semibold">Périodes de Récolte</h4>
                        <ul className="text-sm text-muted-foreground list-disc pl-5">
                          <li>
                            <span className="font-medium">Saison chaude:</span>{' '}
                            {veg.harvestWarm}
                          </li>
                          <li>
                            <span className="font-medium">Saison fraîche:</span>{' '}
                            {veg.harvestCool}
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <AdviceDetail
                      icon={MapPin}
                      title="Plantation"
                      content={veg.advice.plantingLocation}
                    />
                    <AdviceDetail
                      icon={Sun}
                      title="Exposition"
                      content={veg.advice.sunlight}
                    />
                    <AdviceDetail
                      icon={Droplets}
                      title="Arrosage"
                      content={veg.advice.watering}
                    />
                    <AdviceDetail
                      icon={Flower}
                      title="Sol & Engrais"
                      content={veg.advice.soilFertilizer}
                    />
                    <AdviceDetail
                      icon={Bug}
                      title="Nuisibles & Maladies"
                      content={veg.advice.pests}
                    />
                    <AdviceDetail
                      icon={BookHeart}
                      title="Recette de grand-mère"
                      content={veg.advice.grandmaRecipe}
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <BookText className="size-6 text-primary" />
            Lexique du Jardinier
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="font-bold text-lg text-accent">Engrais Vert : Qu'est-ce que c'est ?</h3>
            <p className="text-muted-foreground mt-1">
              Un engrais vert est une culture que l'on ne récolte pas. On la fauche avant qu'elle ne monte en graine et on l'incorpore au sol pour l'enrichir naturellement. C'est le secret d'un sol vivant et fertile !
            </p>
          </div>
          <div className="space-y-4">
             <div className="space-y-1">
                <h4 className="font-semibold">Les Légumineuses (Haricot, Pois, Fève, Crotalaire...)</h4>
                <p className="text-sm text-muted-foreground">
                  Ces plantes ont la capacité magique de capter l'azote de l'air et de le stocker dans leurs racines. En les laissant se décomposer dans le sol, vous offrez un festin d'azote à vos prochaines cultures. Le <strong>crotalaire</strong>, adapté au climat tropical, est très efficace pour régénérer les sols fatigués.
                </p>
              </div>
              <div className="space-y-1">
                <h4 className="font-semibold">La Phacélie</h4>
                <p className="text-sm text-muted-foreground">
                  C'est le couteau suisse du jardinier ! Elle pousse très vite, étouffe les mauvaises herbes, aère le sol en profondeur avec ses racines et ses fleurs violettes attirent les abeilles, un bonus pour la pollinisation.
                </p>
              </div>
              <div className="space-y-1">
                <h4 className="font-semibold">La Moutarde</h4>
                <p className="text-sm text-muted-foreground">
                  En plus d'améliorer la structure du sol, la moutarde a une action "nettoyante". Elle aide à réduire la présence de certains champignons et nématodes (vers microscopiques) nuisibles dans le sol.
                </p>
              </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
