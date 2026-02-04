
'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import { lagoonFishData } from '@/lib/fish-data';
import type { FishSpeciesInfo } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Camera, Fish, AlertTriangle, ChefHat, Target, Sparkles, BrainCircuit, X } from 'lucide-react';
import { identifyFish } from '@/ai/flows/identify-fish-flow';
import type { IdentifyFishOutput } from '@/ai/schemas';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';

export default function FishPage() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const [search, setSearch] = useState('');
  const [isIdentifying, setIsIdentifying] = useState(false);
  const [aiResult, setAiResult] = useState<IdentifyFishOutput | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Synchronisation des personnalisations d'images
  const customizationsRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'fish_customizations');
  }, [firestore]);
  const { data: customizations } = useCollection<{ imageUrl: string }>(customizationsRef);

  const filteredFish = lagoonFishData.filter(f => 
    f.name.toLowerCase().includes(search.toLowerCase()) || 
    f.scientificName.toLowerCase().includes(search.toLowerCase())
  );

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsIdentifying(true);
    setAiResult(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      try {
        const result = await identifyFish({ photoDataUri: base64 });
        setAiResult(result);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (error) {
        console.error(error);
        toast({ 
          variant: 'destructive', 
          title: "Erreur d'analyse", 
          description: "L'IA n'a pas pu traiter l'image. Assurez-vous d'être connecté au réseau." 
        });
      } finally {
        setIsIdentifying(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-full overflow-x-hidden px-1 pb-20">
      <Card className="border-none shadow-none bg-transparent">
        <CardHeader className="px-0">
          <CardTitle className="text-2xl font-black tracking-tight flex items-center gap-2">
            <Fish className="text-primary size-7" /> Guide des Poissons NC
          </CardTitle>
          <CardDescription className="text-xs font-medium">
            Ouvrez votre appareil photo pour identifier une prise ou recherchez une espèce manuellement.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="flex flex-col gap-4">
        <Button 
          onClick={() => fileInputRef.current?.click()} 
          className="h-16 text-lg font-black uppercase tracking-widest shadow-xl gap-3 bg-primary hover:bg-primary/90"
          disabled={isIdentifying}
        >
          {isIdentifying ? (
            <BrainCircuit className="size-7 animate-pulse" />
          ) : (
            <Camera className="size-7" />
          )}
          {isIdentifying ? "Analyse en cours..." : "Prendre en Photo (IA)"}
        </Button>
        <input 
          type="file" 
          accept="image/*" 
          capture="environment" 
          ref={fileInputRef} 
          onChange={handleCapture} 
          className="hidden" 
        />

        <div className="relative mt-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input 
            placeholder="Ou recherchez par nom..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-12 border-2"
          />
        </div>
      </div>

      {aiResult && (
        <Card className="border-2 border-primary bg-primary/5 animate-in fade-in slide-in-from-top-4 duration-500 overflow-hidden relative shadow-lg">
          <button 
            onClick={() => setAiResult(null)}
            className="absolute top-2 right-2 p-1 bg-primary/10 rounded-full hover:bg-primary/20 text-primary z-10"
          >
            <X className="size-4" />
          </button>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="size-4 text-primary" />
              <Badge variant="default" className="text-[10px] font-black uppercase">Ressemblance Identifiée</Badge>
            </div>
            <CardTitle className="text-xl font-black uppercase text-primary leading-none">
              {aiResult.name}
            </CardTitle>
            <CardDescription className="italic font-medium">{aiResult.scientificName}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            <div className="p-3 bg-white/80 backdrop-blur rounded-lg border space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black uppercase text-muted-foreground">Risque de Gratte (Ciguatera)</span>
                <span className={cn("text-xs font-black", aiResult.gratteRisk > 30 ? "text-red-600" : "text-green-600")}>
                  {aiResult.gratteRisk}%
                </span>
              </div>
              <Progress value={aiResult.gratteRisk} className={cn("h-2", aiResult.gratteRisk > 30 ? "bg-red-100" : "bg-green-100")} />
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-primary/10 rounded-lg text-primary shrink-0"><Target className="size-4" /></div>
                <div className="space-y-0.5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Technique de Pêche</p>
                  <p className="text-xs font-medium leading-relaxed">{aiResult.fishingAdvice}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-2 bg-accent/10 rounded-lg text-accent shrink-0"><ChefHat className="size-4" /></div>
                <div className="space-y-0.5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Conseil Culinaire</p>
                  <p className="text-xs font-medium leading-relaxed">{aiResult.culinaryAdvice}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2 px-1">
          <Fish className="size-4" /> Espèces du Caillou
        </h3>
        
        <div className="grid gap-3">
          {filteredFish.map((fish) => {
            const custom = customizations?.find(c => c.id === fish.id);
            const placeholder = PlaceHolderImages.find(img => img.id === fish.imagePlaceholder);
            const finalImageUrl = custom?.imageUrl || placeholder?.imageUrl || '';

            return (
              <Card key={fish.id} className="overflow-hidden border-2 hover:border-primary/30 transition-all">
                <Accordion type="single" collapsible>
                  <AccordionItem value={fish.id} className="border-none">
                    <AccordionTrigger className="p-4 hover:no-underline [&[data-state=open]]:bg-muted/30">
                      <div className="flex items-center gap-4 text-left w-full">
                        <div className="size-20 rounded-xl bg-white flex items-center justify-center shrink-0 overflow-hidden border shadow-inner">
                          {finalImageUrl ? (
                            <Image 
                              src={finalImageUrl} 
                              alt={fish.name} 
                              width={80} 
                              height={80} 
                              className="object-contain w-full h-full p-1"
                              data-ai-hint={placeholder?.imageHint || fish.name}
                            />
                          ) : (
                            <Fish className="size-8 text-primary/40" />
                          )}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <h4 className="font-black uppercase tracking-tighter text-base leading-none truncate">{fish.name}</h4>
                          <p className="text-[10px] text-muted-foreground italic truncate mt-1">{fish.scientificName}</p>
                        </div>
                        <div className="ml-auto pr-4">
                          <Badge 
                            variant={fish.gratteRisk > 20 ? "destructive" : "outline"} 
                            className={cn("text-[8px] h-5 font-black uppercase", fish.gratteRisk <= 20 && "border-green-500 text-green-600")}
                          >
                            Gratte {fish.gratteRisk}%
                          </Badge>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="p-4 space-y-4 bg-muted/10 border-t border-dashed">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-[10px] font-black uppercase text-primary">
                            <Target className="size-3" /> Pêche
                          </div>
                          <p className="text-xs font-medium leading-relaxed">{fish.fishingAdvice}</p>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-[10px] font-black uppercase text-accent">
                            <ChefHat className="size-3" /> Cuisine
                          </div>
                          <p className="text-xs font-medium leading-relaxed">{fish.culinaryAdvice}</p>
                        </div>
                      </div>
                      {fish.gratteRisk > 30 && (
                        <div className="p-3 bg-red-50 border border-red-100 rounded-lg flex gap-3 text-red-800">
                          <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                          <p className="text-[10px] font-bold leading-tight">
                            Attention : Risque de ciguatera élevé. La consommation de gros spécimens est déconseillée.
                          </p>
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
