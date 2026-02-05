'use client';

import { useState, useEffect } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, addDoc, serverTimestamp, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { 
  Flower2, 
  Trash2, 
  BrainCircuit, 
  Droplets, 
  Sun, 
  Scissors, 
  Zap, 
  Plus, 
  Sparkles,
  RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getPersonalizedGardenAdvice } from '@/ai/flows/garden-advice-flow';
import { getGardenSuggestions } from '@/ai/flows/garden-suggestions-flow';
import type { GardenAdviceOutput } from '@/ai/flows/garden-advice-flow';
import type { LocationData, GardenPlant } from '@/lib/types';
import { useLocation } from '@/context/location-context';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const CATEGORIES = ["Arbre Fruitier", "Potager", "Fleur", "Aromatique", "Autre"] as const;

const COMMON_PLANTS = [
  { name: "Citronnier", category: "Arbre Fruitier" },
  { name: "Manguier", category: "Arbre Fruitier" },
  { name: "Avocatier", category: "Arbre Fruitier" },
  { name: "Mandarinier", category: "Arbre Fruitier" },
  { name: "Papayer", category: "Arbre Fruitier" },
  { name: "Bananier", category: "Arbre Fruitier" },
  { name: "Cocotier", category: "Arbre Fruitier" },
  { name: "Letchi", category: "Arbre Fruitier" },
  { name: "Goyavier", category: "Arbre Fruitier" },
  { name: "Hibiscus", category: "Fleur" },
  { name: "Bougainvillier", category: "Fleur" },
  { name: "Frangipanier", category: "Fleur" },
  { name: "Jasmin", category: "Fleur" },
  { name: "Tiare", category: "Fleur" },
  { name: "Rose du désert", category: "Fleur" },
  { name: "Tomate", category: "Potager" },
  { name: "Piment", category: "Potager" },
  { name: "Salade", category: "Potager" },
  { name: "Manioc", category: "Potager" },
  { name: "Igname", category: "Potager" },
  { name: "Taro", category: "Potager" },
  { name: "Patate douce", category: "Potager" },
  { name: "Basilic", category: "Aromatique" },
  { name: "Menthe", category: "Aromatique" },
  { name: "Persil", category: "Aromatique" },
  { name: "Ciboulette", category: "Aromatique" },
];

export function GardenManager({ locationData }: { locationData: LocationData }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { selectedLocation } = useLocation();
  
  const [isAdding, setIsAdding] = useState(false);
  const [plantName, setPlantName] = useState('');
  const [category, setCategory] = useState<typeof CATEGORIES[number] | "">("");
  const [isSaving, setIsSaving] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<{name: string, category: string}[]>([]);
  
  const [adviceCache, setAdviceCache] = useState<Record<string, GardenAdviceOutput>>({});
  const [loadingAdvice, setLoadingAdvice] = useState<Record<string, boolean>>({});

  // Auto-select category if plant is in common list
  useEffect(() => {
    const found = COMMON_PLANTS.find(p => p.name.toLowerCase() === plantName.toLowerCase());
    if (found) {
      setCategory(found.category as any);
    }
  }, [plantName]);

  const plantsRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'users', user.uid, 'garden_plants'), orderBy('createdAt', 'desc'));
  }, [user, firestore]);

  const { data: plants, isLoading: arePlantsLoading } = useCollection<GardenPlant>(plantsRef);

  const handleAiSuggest = async () => {
    setIsSuggesting(true);
    try {
      const month = format(new Date(), 'MMMM', { locale: fr });
      const suggestions = await getGardenSuggestions(month);
      setAiSuggestions(suggestions);
      toast({ title: "Suggestions générées" });
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: "Erreur IA" });
    } finally {
      setIsSuggesting(false);
    }
  };

  const handleSelectSuggestion = (s: {name: string, category: string}) => {
    setPlantName(s.name);
    setCategory(s.category as any);
    setAiSuggestions([]);
  };

  const handleAddPlant = async () => {
    if (!user || !firestore || !plantName || !category) return;
    setIsSaving(true);
    try {
      await addDoc(collection(firestore, 'users', user.uid, 'garden_plants'), {
        userId: user.uid,
        name: plantName,
        category,
        createdAt: serverTimestamp(),
      });
      toast({ title: 'Plante ajoutée !' });
      setPlantName('');
      setCategory("");
      setAiSuggestions([]);
      setIsAdding(false);
    } catch (e) {
      toast({ variant: 'destructive', title: 'Erreur' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!user || !firestore) return;
    try {
      await deleteDoc(doc(firestore, 'users', user.uid, 'garden_plants', id));
      toast({ title: 'Plante retirée' });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Erreur' });
    }
  };

  const fetchAdvice = async (plant: GardenPlant) => {
    if (adviceCache[plant.id] || loadingAdvice[plant.id]) return;

    setLoadingAdvice(prev => ({ ...prev, [plant.id]: true }));
    try {
      const advice = await getPersonalizedGardenAdvice({
        plantName: plant.name,
        category: plant.category,
        location: selectedLocation,
        temperature: locationData.weather.temp,
        rain: locationData.weather.rain,
        lunarPhase: locationData.farming.lunarPhase,
        zodiac: locationData.farming.zodiac
      });
      setAdviceCache(prev => ({ ...prev, [plant.id]: advice }));
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Erreur IA', description: 'Impossible de générer les conseils.' });
    } finally {
      setLoadingAdvice(prev => ({ ...prev, [plant.id]: false }));
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-2 border-dashed border-primary/20 bg-primary/5">
        <CardHeader className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-primary/10 rounded-lg text-primary"><Flower2 className="size-5" /></div>
              <div>
                <CardTitle className="text-lg font-black uppercase">Mon Jardin</CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase">Gérez et entretenez votre terrain</CardDescription>
              </div>
            </div>
            <Button size="sm" onClick={() => setIsAdding(!isAdding)} className="font-black h-8 uppercase text-[10px] tracking-widest">
              {isAdding ? 'Annuler' : <><Plus className="mr-1 size-3" /> Ajouter</>}
            </Button>
          </div>
        </CardHeader>
        {isAdding && (
          <CardContent className="p-4 pt-0 space-y-4 animate-in fade-in slide-in-from-top-2">
            <div className="grid gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] font-black uppercase opacity-60">Saisir le nom de la plante</Label>
                <div className="flex gap-2">
                  <Input 
                    placeholder="Ex: Citronnier, Hibiscus..." 
                    value={plantName} 
                    onChange={e => setPlantName(e.target.value)} 
                    className="h-10 border-2" 
                    list="nc-garden-plants"
                  />
                  <Button 
                    variant="outline" 
                    size="icon" 
                    className="h-10 w-10 shrink-0 border-2" 
                    onClick={handleAiSuggest}
                    disabled={isSuggesting}
                    title="Suggestions IA"
                  >
                    <BrainCircuit className={cn("size-4", isSuggesting && "animate-pulse")} />
                  </Button>
                </div>
                <datalist id="nc-garden-plants">
                  {COMMON_PLANTS.map(p => <option key={p.name} value={p.name} />)}
                </datalist>
              </div>

              {aiSuggestions.length > 0 && (
                <div className="space-y-2 p-3 bg-white border-2 rounded-xl animate-in zoom-in-95">
                  <p className="text-[9px] font-black uppercase text-primary flex items-center gap-1">
                    <Sparkles className="size-3" /> Suggestions pour {format(new Date(), 'MMMM', { locale: fr })} :
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {aiSuggestions.map((s, idx) => (
                      <Badge 
                        key={idx} 
                        variant="secondary" 
                        className="cursor-pointer hover:bg-primary hover:text-white transition-colors py-1 px-2 text-[10px] font-bold uppercase"
                        onClick={() => handleSelectSuggestion(s)}
                      >
                        {s.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <Label className="text-[10px] font-black uppercase opacity-60">Catégorie</Label>
                <Select value={category} onValueChange={(v: any) => setCategory(v)}>
                  <SelectTrigger className="h-10 border-2"><SelectValue placeholder="Choisir..." /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleAddPlant} disabled={isSaving || !plantName || !category} className="w-full font-black uppercase h-10 shadow-md">
                Enregistrer au jardin
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      <div className="space-y-3">
        {arePlantsLoading ? (
          <Skeleton className="h-32 w-full rounded-xl" />
        ) : plants && plants.length > 0 ? (
          <div className="grid gap-3">
            {plants.map((plant) => (
              <Card key={plant.id} className="overflow-hidden border-2 shadow-sm">
                <Accordion type="single" collapsible onValueChange={(val) => val === plant.id && fetchAdvice(plant)}>
                  <AccordionItem value={plant.id} className="border-none">
                    <AccordionTrigger className="p-4 hover:no-underline [&[data-state=open]]:bg-muted/30">
                      <div className="flex items-center gap-4 text-left w-full">
                        <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 border border-primary/10">
                          <Flower2 className="size-6 text-primary" />
                        </div>
                        <div className="flex-grow min-w-0">
                          <h4 className="font-black uppercase tracking-tight text-sm truncate">{plant.name}</h4>
                          <Badge variant="outline" className="text-[8px] font-black uppercase px-1.5 h-4 mt-1 opacity-60">{plant.category}</Badge>
                        </div>
                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDelete(plant.id); }} className="size-8 text-destructive/40 hover:text-destructive">
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="p-0 border-t border-dashed">
                      <div className="p-4 space-y-6 bg-muted/5">
                        {loadingAdvice[plant.id] ? (
                          <div className="flex flex-col items-center justify-center py-8 gap-3">
                            <BrainCircuit className="size-8 text-primary animate-pulse" />
                            <p className="text-[10px] font-black uppercase animate-pulse">L'IA analyse votre jardin...</p>
                          </div>
                        ) : adviceCache[plant.id] ? (
                          <div className="space-y-6 animate-in fade-in">
                            <div className="flex gap-4 p-4 bg-blue-50 border-2 border-blue-100 rounded-2xl">
                              <div className="p-2 bg-blue-600 text-white rounded-xl h-fit shadow-md"><Droplets className="size-5" /></div>
                              <div className="space-y-1">
                                <p className="text-[10px] font-black uppercase text-blue-800 tracking-widest">Arrosage du jour</p>
                                <p className="text-sm font-black text-blue-900">{adviceCache[plant.id].watering.quantity}</p>
                                <p className="text-xs font-medium leading-relaxed text-blue-800/80 italic">"{adviceCache[plant.id].watering.advice}"</p>
                              </div>
                            </div>

                            <div className="space-y-3">
                              <h5 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2 px-1">
                                <Scissors className="size-3 text-orange-500" /> Guide de Taille & Entretien
                              </h5>
                              <div className="p-4 bg-white border-2 rounded-2xl space-y-4 shadow-sm">
                                <div className="flex items-center gap-2">
                                  <Badge variant={adviceCache[plant.id].maintenance.shouldPrune ? 'default' : 'secondary'} className="text-[9px] font-black h-5 uppercase">
                                    {adviceCache[plant.id].maintenance.shouldPrune ? 'Taille Recommandée' : 'Taille déconseillée'}
                                  </Badge>
                                  <span className="text-[9px] font-bold text-muted-foreground">Lune {locationData.farming.lunarPhase === 'Lune Descendante' ? '↗' : '↘'}</span>
                                </div>
                                <div className="space-y-2">
                                  <p className="text-xs font-medium leading-relaxed text-slate-700 bg-muted/30 p-3 rounded-xl border border-dashed">
                                    {adviceCache[plant.id].maintenance.pruningGuide}
                                  </p>
                                </div>
                                <div className="flex items-start gap-3 pt-2 border-t border-dashed">
                                  <Zap className="size-4 text-yellow-500 shrink-0 mt-0.5" />
                                  <div className="space-y-0.5">
                                    <p className="text-[9px] font-black uppercase text-muted-foreground">Nutrition & Boost</p>
                                    <p className="text-xs font-medium leading-relaxed">{adviceCache[plant.id].maintenance.boosterAdvice}</p>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div className="p-4 bg-indigo-50 border-2 border-indigo-100 rounded-2xl space-y-2">
                                <div className="flex items-center gap-2 text-indigo-800"><Sparkles className="size-4" /><span className="text-[9px] font-black uppercase">Rendement NC</span></div>
                                <p className="text-[11px] font-medium leading-relaxed text-indigo-900">{adviceCache[plant.id].milestones.yieldTips}</p>
                              </div>
                              <div className="p-4 bg-green-50 border-2 border-green-100 rounded-2xl space-y-2">
                                <div className="flex items-center gap-2 text-green-800"><Sun className="size-4" /><span className="text-[9px] font-black uppercase">Étape Suivante</span></div>
                                <p className="text-[11px] font-black text-green-900 uppercase tracking-tighter">{adviceCache[plant.id].milestones.flowering}</p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <p className="text-center text-xs italic opacity-40 py-4">Cliquez pour analyser...</p>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 border-2 border-dashed rounded-3xl opacity-40">
            <Flower2 className="size-12 mx-auto mb-3" />
            <p className="font-black uppercase tracking-widest text-xs">Votre jardin est vide</p>
            <Button variant="link" onClick={() => setIsAdding(true)} className="text-[10px] font-bold uppercase mt-2">Enregistrer ma première plante</Button>
          </div>
        )}
      </div>
    </div>
  );
}
