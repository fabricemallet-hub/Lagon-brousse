
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
import { Ban, Check, Scale, BookOpen, Crosshair, LifeBuoy, ShieldCheck, Info, Zap, Plus } from 'lucide-react';
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
    name: 'Notou',
    allowed: [3], // Avril
    details: 'Chasse ouverte uniquement les week-ends d\'avril. Quota : 5/chasseur/jour.',
  },
  {
    name: 'Roussette',
    allowed: [3], // Avril
    details: 'Chasse autorisée uniquement les week-ends du mois d\'avril. Quota : 5/chasseur/jour.',
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
    <div className="space-y-6 pb-12">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-black uppercase tracking-tighter">Réglementation NC</CardTitle>
          <CardDescription className="text-xs">
            Résumé des principales règles de pêche, de chasse et de sécurité maritime.
            Ce guide ne remplace pas les textes officiels de la Province Sud et de la DAM.
          </CardDescription>
        </CardHeader>
      </Card>
      
      {/* SECTION SÉCURITÉ MARITIME */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-black uppercase text-base">
            <LifeBuoy className="text-primary size-5" />
            Sécurité & Armement des Navires
          </CardTitle>
          <CardDescription className="text-[10px] font-bold uppercase opacity-70">
            Réglementation adaptée localement (Délibération n°119/CP de 2018).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs font-medium leading-relaxed italic text-muted-foreground border-l-4 border-primary pl-3 py-1">
            En Nouvelle-Calédonie, le contenu de votre "boîte" ou armement de sécurité dépend de votre distance d'un abri.
          </p>

          <Accordion type="single" collapsible className="w-full space-y-2">
            <AccordionItem value="basique" className="border-2 rounded-xl bg-card overflow-hidden">
              <AccordionTrigger className="px-4 py-3 hover:no-underline text-sm font-black uppercase">
                1. Navigation Basique ({"<"} 2 milles)
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 pt-2">
                <div className="space-y-3">
                  <p className="text-[10px] font-black uppercase text-primary">Minimum pour le lagon proche ou les baies :</p>
                  <ul className="space-y-2">
                    <li className="flex gap-2 text-xs font-medium">
                      <Check className="size-3 text-green-600 shrink-0 mt-0.5" />
                      <span><strong>EIF :</strong> Un gilet par personne, minimum 50 Newtons.</span>
                    </li>
                    <li className="flex gap-2 text-xs font-medium">
                      <Check className="size-3 text-green-600 shrink-0 mt-0.5" />
                      <span><strong>Dispositif lumineux :</strong> Lampe torche étanche ou moyen de repérage individuel (flash-light) avec 6h d'autonomie.</span>
                    </li>
                    <li className="flex gap-2 text-xs font-medium">
                      <Check className="size-3 text-green-600 shrink-0 mt-0.5" />
                      <span><strong>Incendie :</strong> Extincteur(s) selon préconisations du constructeur.</span>
                    </li>
                    <li className="flex gap-2 text-xs font-medium">
                      <Check className="size-3 text-green-600 shrink-0 mt-0.5" />
                      <span><strong>Remorquage :</strong> Point d'amarrage (taquet) et ligne de mouillage/remorquage adaptée.</span>
                    </li>
                    <li className="flex gap-2 text-xs font-medium">
                      <Check className="size-3 text-green-600 shrink-0 mt-0.5" />
                      <span><strong>Écopage :</strong> Écope manuelle ou pompe de cale.</span>
                    </li>
                    <li className="flex gap-2 text-xs font-medium">
                      <Check className="size-3 text-green-600 shrink-0 mt-0.5" />
                      <span><strong>Annuaire des marées :</strong> Format papier ou numérique.</span>
                    </li>
                    <li className="flex gap-2 text-xs font-medium">
                      <Check className="size-3 text-green-600 shrink-0 mt-0.5" />
                      <span><strong>Pavillon national :</strong> Obligatoire (sauf propulsion humaine).</span>
                    </li>
                  </ul>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="cotiere" className="border-2 rounded-xl bg-card overflow-hidden">
              <AccordionTrigger className="px-4 py-3 hover:no-underline text-sm font-black uppercase">
                2. Navigation Côtière ({"<"} 6 milles)
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 pt-2">
                <div className="space-y-3">
                  <p className="text-[10px] font-black uppercase text-primary">Sorties aux îlots (Amédée, Signal, etc.). Matériel "Basique" + :</p>
                  <ul className="space-y-2">
                    <li className="flex gap-2 text-xs font-medium">
                      <Plus className="size-3 text-primary shrink-0 mt-0.5" />
                      <span><strong>Gilets de sauvetage :</strong> Doivent passer à 100 Newtons minimum.</span>
                    </li>
                    <li className="flex gap-2 text-xs font-medium">
                      <Plus className="size-3 text-primary shrink-0 mt-0.5" />
                      <span><strong>Repérage :</strong> Lampe torche étanche ou feu à retournement.</span>
                    </li>
                    <li className="flex gap-2 text-xs font-medium">
                      <Plus className="size-3 text-primary shrink-0 mt-0.5" />
                      <span><strong>Signalisation :</strong> 3 feux rouges à main.</span>
                    </li>
                    <li className="flex gap-2 text-xs font-medium">
                      <Plus className="size-3 text-primary shrink-0 mt-0.5" />
                      <span><strong>Compas :</strong> Magnétique étanche et fixé (ou GPS sous conditions).</span>
                    </li>
                    <li className="flex gap-2 text-xs font-medium">
                      <Plus className="size-3 text-primary shrink-0 mt-0.5" />
                      <span><strong>Cartes marines :</strong> Papier ou électronique officielle de la zone.</span>
                    </li>
                    <li className="flex gap-2 text-xs font-medium">
                      <Plus className="size-3 text-primary shrink-0 mt-0.5" />
                      <span><strong>RIPAM :</strong> Règlement pour prévenir les abordages.</span>
                    </li>
                    <li className="flex gap-2 text-xs font-medium">
                      <Plus className="size-3 text-primary shrink-0 mt-0.5" />
                      <span><strong>Miroir de signalisation.</strong></span>
                    </li>
                  </ul>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="semi-hauturiere" className="border-2 rounded-xl bg-card overflow-hidden">
              <AccordionTrigger className="px-4 py-3 hover:no-underline text-sm font-black uppercase">
                3. Navigation Semi-Hauturière (6 à 60 milles)
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 pt-2">
                <div className="space-y-3">
                  <p className="text-[10px] font-black uppercase text-primary">Hors lagon ou vers les Loyauté. Matériel "Côtier" + :</p>
                  <ul className="space-y-2">
                    <li className="flex gap-2 text-xs font-medium">
                      <Plus className="size-3 text-primary shrink-0 mt-0.5" />
                      <span><strong>Gilets :</strong> Minimum 150 Newtons.</span>
                    </li>
                    <li className="flex gap-2 text-xs font-medium">
                      <Plus className="size-3 text-primary shrink-0 mt-0.5" />
                      <span><strong>Radeau de survie :</strong> Obligatoire.</span>
                    </li>
                    <li className="flex gap-2 text-xs font-medium">
                      <Plus className="size-3 text-primary shrink-0 mt-0.5" />
                      <span><strong>Signalisation :</strong> 3 fusées à parachute et 2 fumigènes (ou VHF ASN fixe).</span>
                    </li>
                    <li className="flex gap-2 text-xs font-medium">
                      <Plus className="size-3 text-primary shrink-0 mt-0.5" />
                      <span><strong>VHF fixe :</strong> Obligatoire.</span>
                    </li>
                    <li className="flex gap-2 text-xs font-medium">
                      <Plus className="size-3 text-primary shrink-0 mt-0.5" />
                      <span><strong>Trousse de secours :</strong> Conforme à la réglementation.</span>
                    </li>
                  </ul>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="recos" className="border-2 rounded-xl bg-amber-50 border-amber-200 overflow-hidden">
              <AccordionTrigger className="px-4 py-3 hover:no-underline text-sm font-black uppercase text-amber-900">
                <div className="flex items-center gap-2"><Zap className="size-4 fill-amber-500 text-amber-500" /> Conseils Experts NC</div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 pt-2 space-y-4">
                <div className="space-y-3">
                  <div className="bg-white p-3 rounded-lg border border-amber-100 shadow-sm">
                    <p className="text-[10px] font-black uppercase text-amber-600 mb-1">VHF Portable</p>
                    <p className="text-xs font-medium leading-relaxed">
                      Bien que non obligatoire en zone côtière, elle est **fortement recommandée** par la SNSM et la DAM car le réseau téléphone est capricieux sur l'eau.
                    </p>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-amber-100 shadow-sm">
                    <p className="text-[10px] font-black uppercase text-amber-600 mb-1">Miroir de signalisation</p>
                    <p className="text-xs font-medium leading-relaxed">
                      Très utile sous le soleil calédonien pour attirer l'attention de loin par réverbération.
                    </p>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-amber-100 shadow-sm">
                    <p className="text-[10px] font-black uppercase text-amber-600 mb-1">Vérification</p>
                    <p className="text-xs font-medium leading-relaxed">
                      Pensez à vérifier les dates de péremption de vos fusées et la date de révision de vos extincteurs.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2 p-3 bg-slate-100 rounded-lg">
                  <Info className="size-4 text-slate-500 shrink-0 mt-0.5" />
                  <p className="text-[10px] font-bold italic leading-tight text-slate-600">
                    <strong>Note sur l'Abri :</strong> Un "abri" est un lieu où le navire peut accoster ou mouiller en sécurité et où les personnes à bord peuvent être débarquées en sécurité.
                  </p>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-black uppercase text-base">
            <BookOpen className="text-primary size-5" />
            Calendrier des Pêches
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {fishingCalendarData.map((item) => (
            <div key={item.name} className="border-b last:border-0 pb-6 last:pb-0">
              <h4 className="font-bold text-sm mb-3 uppercase tracking-tight">{item.name}</h4>
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-12 gap-1 mb-2">
                {months.map((month, index) => (
                  <div
                    key={month}
                    className={cn(
                      'flex flex-col items-center justify-center rounded-md h-12 text-center p-1',
                      item.forbidden.includes(index)
                        ? 'bg-destructive/10 text-destructive'
                        : 'bg-green-600/10 text-green-800'
                    )}
                  >
                    <span className="text-[9px] font-black uppercase">{month}</span>
                    {item.forbidden.includes(index) ? (
                      <Ban className="size-3.5 mt-1" />
                    ) : (
                      <Check className="size-3.5 mt-1 text-green-600" />
                    )}
                  </div>
                ))}
              </div>
              <p className="text-[11px] font-medium text-muted-foreground italic leading-tight">{item.details}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-black uppercase text-base">
            <Crosshair className="text-primary size-5" />
            Calendrier de Chasse
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {huntingCalendarData.map((item) => (
            <div key={item.name} className="border-b last:border-0 pb-6 last:pb-0">
              <h4 className="font-bold text-sm mb-3 uppercase tracking-tight">{item.name}</h4>
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-12 gap-1 mb-2">
                {months.map((month, index) => (
                  <div
                    key={month}
                    className={cn(
                      'flex flex-col items-center justify-center rounded-md h-12 text-center p-1',
                      item.allowed.includes(index)
                        ? 'bg-green-600/10 text-green-800'
                        : 'bg-destructive/10 text-destructive'
                    )}
                  >
                    <span className="text-[9px] font-black uppercase">{month}</span>
                    {item.allowed.includes(index) ? (
                      <Check className="size-3.5 mt-1 text-green-600" />
                    ) : (
                      <Ban className="size-3.5 mt-1" />
                    )}
                  </div>
                ))}
              </div>
              <p className="text-[11px] font-medium text-muted-foreground italic leading-tight">{item.details}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-black uppercase text-base">
            <Scale className="text-primary size-5" />
            Autres Réglementations (Pêche)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger className="text-sm font-bold">Tailles & Quantités</AccordionTrigger>
              <AccordionContent>
                <ul className="list-disc space-y-2 pl-5 text-xs">
                  <li>
                    <strong>Bénitier:</strong> Limité à 2 par sortie, par
                    bateau/pêcheur.
                  </li>
                  <li>
                    <strong>Troca:</strong> Diamètre de base entre 9 et 12 cm.
                  </li>
                  <li>
                    <strong>Huître roche ou de palétuvier:</strong> Taille {">"} 6 cm, limité à 10
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
              <AccordionTrigger className="text-sm font-bold">Marquage Obligatoire</AccordionTrigger>
              <AccordionContent>
                <p className="text-xs leading-relaxed">
                  <strong>
                    Langoustes, popinées, et cigales de mer (grainées ou non):
                  </strong>{' '}
                  Le marquage de la queue est obligatoire toute l'année dès la capture.
                </p>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-3">
              <AccordionTrigger className="text-sm font-bold">Espèces Strictement Protégées</AccordionTrigger>
              <AccordionContent>
                <p className="text-xs leading-relaxed mb-3">
                  La pêche, capture, détention, transport, ou commercialisation
                  sont <strong>formellement interdits</strong> pour :
                </p>
                <div className="flex flex-wrap gap-1.5">
                    {[
                        'Tricot rayé', 'Tortues marines', 'Dugong',
                        'Cétacés', 'Requins', 'Napoléon', 'Volute', 'Toutoute',
                        'Casque', 'Nautile', 'Oiseaux marins', 'Coraux vivants'
                    ].map(species => <Badge key={species} variant="destructive" className="text-[8px] font-black uppercase px-1.5 h-4">{species}</Badge>)}
                </div>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-4">
              <AccordionTrigger className="text-sm font-bold">Sanctions</AccordionTrigger>
              <AccordionContent className="text-xs leading-relaxed">
                Le non-respect de la réglementation expose les contrevenants
                à des amendes lourdes, à la saisie du matériel, des produits de la
                pêche et du navire.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}
