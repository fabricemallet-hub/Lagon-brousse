
'use client';

import { useState } from 'react';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, orderBy, addDoc, serverTimestamp, doc, updateDoc, increment } from 'firebase/firestore';
import type { FaqEntry } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, ChevronLeft, HelpCircle, MessageSquare, Sparkles, Send, RefreshCw, TrendingUp } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const CATEGORIES = ["General", "Peche", "Boat Tracker", "Chasse", "Champs", "Compte"];

export default function FaqPage() {
  const router = useRouter();
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  // États pour le ticket direct
  const [isTicketOpen, setIsTicketOpen] = useState(false);
  const [sujet, setSujet] = useState('');
  const [description, setDescription] = useState('');
  const [isSending, setIsSending] = useState(false);

  // La requête est maintenant ordonnée par VUES (Décroissant) pour mettre les plus lues en haut
  const faqRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, 'cms_support', 'faq', 'items'), 
      orderBy('views', 'desc'),
      orderBy('ordre', 'asc')
    );
  }, [firestore]);

  const { data: faqs, isLoading } = useCollection<FaqEntry>(faqRef);

  const filteredFaqs = faqs?.filter(f => {
    const matchesSearch = f.question.toLowerCase().includes(search.toLowerCase()) || 
                         f.reponse.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = activeCategory ? f.categorie === activeCategory : true;
    return matchesSearch && matchesCategory;
  });

  const handleTrackView = async (id: string) => {
    if (!firestore) return;
    const itemRef = doc(firestore, 'cms_support', 'faq', 'items', id);
    // Incrémente le compteur de vues de manière atomique
    updateDoc(itemRef, { views: increment(1) }).catch(e => console.warn("View tracking failed", e));
  };

  const handleSendTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !firestore || !sujet || !description) return;

    setIsSending(true);
    try {
      await addDoc(collection(firestore, 'cms_support', 'tickets', 'items'), {
        userId: user.uid,
        userEmail: user.email,
        sujet,
        description,
        statut: 'ouvert',
        createdAt: serverTimestamp()
      });
      toast({ title: "Ticket envoyé !", description: "Notre équipe reviendra vers vous très prochainement." });
      setSujet('');
      setDescription('');
      setIsTicketOpen(false);
    } catch (e) {
      toast({ variant: 'destructive', title: "Erreur", description: "Impossible d'envoyer le ticket." });
    } finally {
      setIsSending(false);
    }
  };

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
        <div className="flex items-center gap-2 px-1 text-[10px] font-black uppercase text-muted-foreground tracking-widest">
            <TrendingUp className="size-3 text-primary" /> Classé par popularité
        </div>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        ) : filteredFaqs && filteredFaqs.length > 0 ? (
          <Accordion type="single" collapsible className="w-full space-y-3" onValueChange={(val) => val && handleTrackView(val)}>
            {filteredFaqs.map((faq) => (
              <AccordionItem key={faq.id} value={faq.id} className="border-2 rounded-2xl bg-card overflow-hidden shadow-sm transition-all border-transparent hover:border-primary/20">
                <AccordionTrigger className="px-4 py-4 hover:no-underline text-left">
                  <div className="flex flex-col gap-1.5 min-w-0 pr-4">
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className="w-fit text-[8px] font-black uppercase h-4 px-1.5 bg-primary/5 text-primary border-primary/10">{faq.categorie}</Badge>
                        {faq.views && faq.views > 10 && (
                            <Badge variant="secondary" className="bg-orange-100 text-orange-700 border-none text-[7px] font-black h-4 px-1.5 uppercase tracking-tighter">Populaire</Badge>
                        )}
                    </div>
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
          <Dialog open={isTicketOpen} onOpenChange={setIsTicketOpen}>
            <DialogTrigger asChild>
              <Button className="w-full h-14 font-black uppercase tracking-widest shadow-lg bg-accent hover:bg-accent/90">
                Ouvrir un ticket support
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md rounded-2xl">
              <DialogHeader>
                <DialogTitle className="font-black uppercase">Nouveau Ticket Support</DialogTitle>
                <DialogDescription className="text-xs">Votre message sera traité par un administrateur sous 24h.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSendTicket} className="space-y-4 py-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase ml-1 opacity-60">Sujet</Label>
                  <Input 
                    placeholder="Ex: Problème de paiement, Bug Boat Tracker..." 
                    value={sujet}
                    onChange={e => setSujet(e.target.value)}
                    className="h-12 border-2 font-bold"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase ml-1 opacity-60">Message détaillé</Label>
                  <Textarea 
                    placeholder="Expliquez-nous votre demande avec précision..." 
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    className="border-2 font-medium min-h-[120px]"
                    required
                  />
                </div>
                <Button type="submit" disabled={isSending || !user} className="w-full h-14 font-black uppercase tracking-widest gap-2 shadow-lg">
                  {isSending ? <RefreshCw className="size-5 animate-spin" /> : <Send className="size-5" />}
                  {isSending ? "Envoi en cours..." : "Envoyer mon ticket"}
                </Button>
                {!user && <p className="text-[10px] text-center text-destructive font-bold uppercase">Connexion requise pour envoyer un ticket</p>}
              </form>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}
