
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
import { Search, ChevronLeft, HelpCircle, MessageSquare } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';

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

        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <Button 
            variant={activeCategory === null ? 'default' : 'outline'} 
            size="sm" 
            onClick={() => setActiveCategory(null)}
            className="text-[10px] font-black uppercase shrink-0"
          >
            Tout
          </Button>
          {CATEGORIES.map(cat => (
            <Button 
              key={cat}
              variant={activeCategory === cat ? 'default' : 'outline'} 
              size="sm" 
              onClick={() => setActiveCategory(cat)}
              className="text-[10px] font-black uppercase shrink-0"
            >
              {cat}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : filteredFaqs && filteredFaqs.length > 0 ? (
          <Accordion type="single" collapsible className="w-full space-y-2">
            {filteredFaqs.map((faq) => (
              <AccordionItem key={faq.id} value={faq.id} className="border-2 rounded-xl bg-card overflow-hidden">
                <AccordionTrigger className="px-4 py-4 hover:no-underline text-left">
                  <div className="flex flex-col gap-1">
                    <Badge variant="outline" className="w-fit text-[8px] font-black uppercase h-4 px-1.5">{faq.categorie}</Badge>
                    <span className="font-bold text-sm leading-tight pr-4">{faq.question}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4 pt-2 text-xs leading-relaxed text-muted-foreground border-t border-dashed">
                  {faq.reponse}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        ) : (
          <div className="text-center py-12 border-2 border-dashed rounded-3xl opacity-40">
            <HelpCircle className="size-12 mx-auto mb-2" />
            <p className="font-black uppercase tracking-widest text-xs">Aucune réponse trouvée</p>
          </div>
        )}
      </div>

      <Card className="border-2 border-primary/20 bg-primary/5 mt-4">
        <CardHeader className="p-4">
          <CardTitle className="text-sm font-black uppercase flex items-center gap-2">
            <MessageSquare className="size-4 text-primary" /> Vous ne trouvez pas ?
          </CardTitle>
          <CardDescription className="text-[10px]">Notre équipe technique vous répond sous 24h.</CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <Button asChild className="w-full h-12 font-black uppercase tracking-widest shadow-md">
            <Link href="/aide/support">Ouvrir un ticket</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
