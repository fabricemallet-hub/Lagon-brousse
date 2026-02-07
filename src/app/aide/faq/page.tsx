'use client';

import { useState } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import type { FaqEntry } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, ChevronLeft, HelpCircle, MessageSquare, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { cn } from '@/lib/utils';

const CATEGORIES = ["General", "Peche", "Boat Tracker", "Chasse", "Champs", "Compte"];

export default function FaqPage() {
  const router = useRouter();
  const firestore = useFirestore();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const faqRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'cms_support', 'faq', 'items'), orderBy('ordre', 'asc'));
  }, [firestore]);

  const { data: faqs, isLoading } = useCollection<FaqEntry>(faqRef);

  const filteredFaqs = faqs?.filter(f => {
    const matchesSearch = f.question.toLowerCase().includes(search.toLowerCase()) || 
                         f.reponse.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = activeCategory ? f.categorie === activeCategory : true;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="flex flex-col gap-6 w-full max-w-full overflow-x-hidden px-1 pb-20">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => router.back()}><ChevronLeft className="size-6" /></Button>
        <h1 className="text-2xl font-black uppercase tracking-tighter">FAQ & Support</h1>
      </div>

      <div className="flex flex-col gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input 
            placeholder="Rechercher une question..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-12 border-2"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide px-1">
          <Button 
            variant={activeCategory === null ? 'default' : 'outline'} 
            size="sm" 
            onClick={() => setActiveCategory(null)}
            className="text-[10px] font-black uppercase shrink-0 rounded-full h-8"
          >
            Tout
          </Button>
          {CATEGORIES.map(cat => (
            <Button 
              key={cat}
              variant={activeCategory === cat ? 'default' : 'outline'} 
              size="sm" 
              onClick={() => setActiveCategory(cat)}
              className="text-[10px] font-black uppercase shrink-0 rounded-full h-8"
            >
              {cat}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        ) : filteredFaqs && filteredFaqs.length > 0 ? (
          <Accordion type="single" collapsible className="w-full space-y-3">
            {filteredFaqs.map((faq) => (
              <AccordionItem key={faq.id} value={faq.id} className="border-2 rounded-2xl bg-card overflow-hidden shadow-sm transition-all border-transparent hover:border-primary/20">
                <AccordionTrigger className="px-4 py-4 hover:no-underline text-left">
                  <div className="flex flex-col gap-1.5 min-w-0 pr-4">
                    <Badge variant="outline" className="w-fit text-[8px] font-black uppercase h-4 px-1.5 bg-primary/5 text-primary border-primary/10">{faq.categorie}</Badge>
                    <span className="font-black text-sm leading-tight text-slate-800">{faq.question}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-5 pt-3 text-xs leading-relaxed text-muted-foreground border-t border-dashed bg-muted/10 font-medium">
                  {faq.reponse}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        ) : (
          <div className="text-center py-16 border-4 border-dashed rounded-[2rem] flex flex-col items-center gap-4 opacity-30">
            <div className="p-4 bg-muted rounded-full">
                <HelpCircle className="size-10" />
            </div>
            <p className="font-black uppercase tracking-widest text-xs">Aucune réponse trouvée</p>
          </div>
        )}
      </div>

      <Card className="border-2 border-accent/20 bg-accent/5 mt-6 relative overflow-hidden">
        <div className="absolute -right-4 -bottom-4 opacity-10 rotate-12">
            <Sparkles className="size-24 text-accent" />
        </div>
        <CardHeader className="p-5">
          <CardTitle className="text-sm font-black uppercase flex items-center gap-2">
            <MessageSquare className="size-4 text-accent" /> Vous avez une question spécifique ?
          </CardTitle>
          <CardDescription className="text-[10px] font-bold uppercase opacity-60">Notre équipe technique vous répond sous 24h.</CardDescription>
        </CardHeader>
        <CardContent className="p-5 pt-0">
          <Button asChild className="w-full h-14 font-black uppercase tracking-widest shadow-lg bg-accent hover:bg-accent/90">
            <Link href="/aide/support">Ouvrir un ticket support</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
