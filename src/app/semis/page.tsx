
'use client';

import { useState, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
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
  Plus,
  BrainCircuit,
  Search,
  Sprout,
  CalendarDays,
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useUser, useFirestore } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { format, addDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { getGardeningAdvice } from '@/ai/flows/gardening-flow';
import { useLocation } from '@/context/location-context';
import { generateProceduralData, getDataForDate } from '@/lib/data';
import { Calendar as CalendarUI } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

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
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { selectedLocation } = useLocation();

  const [searchQuery, setSearchQuery] = useState('');
  const [isPlanningOpen, setIsPlanningOpen] = useState(false);
  const [selectedVeg, setSelectedVeg] = useState<string | null>(null);
  const [customVeg, setCustomVeg] = useState('');
  const [sowingDate, setSowingDate] = useState<Date>(new Date());
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const filteredData = semisData.filter(veg => 
    veg.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getUpcomingGardeningCalendar = (location: string, startDate: Date, days: number = 30) => {
    const schedule = [];
    for (let i = 0; i < days; i++) {
      const d = addDays(startDate, i);
      const data = generateProceduralData(location, d);
      schedule.push({
        date: format(d, 'yyyy-MM-dd'),
        phase: data.farming.lunarPhase,
        zodiac: data.farming.zodiac
      });
    }
    return schedule.map(s => `- ${s.date} : ${s.phase}, Jour ${s.zodiac}`).join('\n');
  };

  const handlePlanSowing = async () => {
    const plantName = selectedVeg === 'CUSTOM' ? customVeg : selectedVeg;
    if (!user || !firestore || !plantName) return;

    setIsAnalyzing(true);
    try {
      const locationData = getDataForDate(selectedLocation, sowingDate);
      const upcomingCalendar = getUpcomingGardeningCalendar(selectedLocation, sowingDate);

      const advice = await getGardeningAdvice({
        seedName: plantName,
        sowingDate: sowingDate.toISOString(),
        lunarPhase: locationData.farming.lunarPhase,
        zodiacSign: locationData.farming.zodiac,
        upcomingCalendar
      });

      const newSowing = {
        userId: user.uid,
        seedName: plantName,
        sowingDate: sowingDate.toISOString(),
        plantType: advice.plantType,
        cultureAdvice: advice.cultureAdvice,
        estimatedHarvestDate: advice.harvestDate,
        transplantingAdvice: advice.transplantingAdvice,
        moonWarning: advice.moonWarning,
        isValidForMoon: advice.isValidForMoon,
        lunarContext: {
          phase: locationData.farming.lunarPhase,
          zodiac: locationData.farming.zodiac
        },
        createdAt: serverTimestamp()
      };

      await addDoc(collection(firestore, 'users', user.uid, 'sowings'), newSowing);
      
      toast({ 
        title: advice.isValidForMoon ? 'Semis enregistré !' : 'Avertissement Lunaire', 
        description: advice.moonWarning,
        variant: advice.isValidForMoon ? 'default' : 'destructive'
      });
      
      setIsPlanningOpen(false);
      setSelectedVeg(null);
      setCustomVeg('');
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de générer les conseils IA.' });
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <Card className="overflow-hidden border-none shadow-lg bg-gradient-to-br from-green-600 to-emerald-700 text-white">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2"><Sprout /> Guide & Planificateur</CardTitle>
          <CardDescription className="text-green-50/80">
            Consultez les fiches ou planifiez vos cultures avec l'aide de l'IA.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-emerald-200" />
            <Input 
              placeholder="Rechercher une plante ou ajouter une variété..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white/10 border-white/20 text-white placeholder:text-emerald-100/50 pl-10 h-12"
            />
          </div>
        </CardContent>
      </Card>

      {searchQuery && filteredData.length === 0 && (
        <Card className="border-dashed border-2 bg-muted/30">
          <CardContent className="flex flex-col items-center justify-center py-10 text-center gap-4">
            <div className="p-4 bg-primary/10 rounded-full text-primary">
              <Sparkles className="size-8" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-lg">Plante non répertoriée ?</h3>
              <p className="text-sm text-muted-foreground">L'IA peut créer une fiche personnalisée pour "{searchQuery}" et l'ajouter à vos semis.</p>
            </div>
            <Button onClick={() => { setSelectedVeg('CUSTOM'); setCustomVeg(searchQuery); setIsPlanningOpen(true); }} className="font-bold">
              Planifier "{searchQuery}" avec l'IA
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Conseils de Culture</CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            {filteredData.map((veg) => (
              <AccordionItem value={veg.name} key={veg.name}>
                <AccordionTrigger className="text-lg hover:no-underline py-4">
                  <div className="flex items-center justify-between w-full pr-4">
                    <div className="flex items-center gap-4">
                      <span className="text-2xl">{veg.icon}</span>
                      <span className="font-bold">{veg.name}</span>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-6 pt-4">
                  <div className="flex flex-col sm:flex-row gap-2 pb-4">
                    <Button 
                      className="w-full sm:w-auto font-bold gap-2" 
                      variant="default"
                      onClick={() => { setSelectedVeg(veg.name); setIsPlanningOpen(true); }}
                    >
                      <Plus className="size-4" /> Planifier ce semis
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-4 rounded-xl bg-muted/50 border">
                    <div className="flex items-start gap-3">
                      <Calendar className="size-5 text-accent mt-1" />
                      <div>
                        <h4 className="font-semibold">Périodes de Semis</h4>
                        <ul className="text-sm text-muted-foreground list-disc pl-5">
                          <li><span className="font-medium">Saison chaude:</span> {veg.sowingSeasonWarm}</li>
                          <li><span className="font-medium">Saison fraîche:</span> {veg.sowingSeasonCool}</li>
                        </ul>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Wheat className="size-5 text-accent mt-1" />
                       <div>
                        <h4 className="font-semibold">Récolte</h4>
                        <ul className="text-sm text-muted-foreground list-disc pl-5">
                          <li><span className="font-medium">Saison chaude:</span> {veg.harvestWarm}</li>
                          <li><span className="font-medium">Saison fraîche:</span> {veg.harvestCool}</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <AdviceDetail icon={MapPin} title="Plantation" content={veg.advice.plantingLocation} />
                    <AdviceDetail icon={Sun} title="Exposition" content={veg.advice.sunlight} />
                    <AdviceDetail icon={Droplets} title="Arrosage" content={veg.advice.watering} />
                    <AdviceDetail icon={Flower} title="Sol & Engrais" content={veg.advice.soilFertilizer} />
                    <AdviceDetail icon={Bug} title="Nuisibles" content={veg.advice.pests} />
                    <AdviceDetail icon={BookHeart} title="Astuce du guide" content={veg.advice.grandmaRecipe} />
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
              Un engrais vert est une culture que l'on ne récolte pas. On la fauche avant qu'elle ne monte en graine et on l'incorpore au sol pour l'enrichir naturellement.
            </p>
          </div>
          <div className="space-y-4">
             <div className="space-y-1">
                <h4 className="font-semibold">Les Légumineuses (Haricot, Pois, Crotalaire...)</h4>
                <p className="text-sm text-muted-foreground text-pretty">
                  Ces plantes captent l'azote de l'air. En les laissant se décomposer, vous offrez un festin d'azote à vos prochaines cultures.
                </p>
              </div>
              <div className="space-y-1">
                <h4 className="font-semibold">La Phacélie</h4>
                <p className="text-sm text-muted-foreground">
                  Pousse vite, étouffe les mauvaises herbes, aère le sol et attire les abeilles avec ses fleurs violettes.
                </p>
              </div>
          </div>
        </CardContent>
      </Card>

      {/* Planning Dialog */}
      <Dialog open={isPlanningOpen} onOpenChange={setIsPlanningOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Planifier un semis</DialogTitle>
            <DialogDescription>
              L'IA va calculer les meilleurs conseils pour {selectedVeg === 'CUSTOM' ? customVeg : selectedVeg} selon la lune.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-bold uppercase text-muted-foreground">Date de mise en semis</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal h-12">
                    <CalendarDays className="mr-2 h-5 w-5" />
                    {sowingDate ? format(sowingDate, 'PPP', { locale: fr }) : "Choisir une date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarUI mode="single" selected={sowingDate} onSelect={(d) => d && setSowingDate(d)} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsPlanningOpen(false)}>Annuler</Button>
            <Button onClick={handlePlanSowing} disabled={isAnalyzing}>
              {isAnalyzing ? <><BrainCircuit className="mr-2 animate-pulse" /> Analyse IA...</> : "Valider & Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
