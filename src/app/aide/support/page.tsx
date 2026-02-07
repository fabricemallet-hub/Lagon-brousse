
'use client';

import { useState } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, addDoc, serverTimestamp, query, where, orderBy } from 'firebase/firestore';
import type { SupportTicket } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, Send, MessageSquare, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export default function SupportPage() {
  const router = useRouter();
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [sujet, setSujet] = useState('');
  const [description, setDescription] = useState('');
  const [isSending, setIsSending] = useState(false);

  const ticketsRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, 'cms_support', 'tickets', 'items'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
  }, [firestore, user]);

  const { data: tickets, isLoading } = useCollection<SupportTicket>(ticketsRef);

  const handleSubmit = async (e: React.FormEvent) => {
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
      toast({ title: "Ticket envoyé !", description: "Nous reviendrons vers vous très bientôt." });
      setSujet('');
      setDescription('');
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
        <h1 className="text-2xl font-black uppercase tracking-tighter">Support Technique</h1>
      </div>

      <Card className="border-2 shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg font-black uppercase">Nouveau Ticket</CardTitle>
          <CardDescription className="text-xs">Décrivez votre problème ou suggestion avec précision.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase ml-1 opacity-60">Sujet</Label>
              <Input 
                placeholder="Ex: Problème de paiement, Bug sur la carte..." 
                value={sujet}
                onChange={e => setSujet(e.target.value)}
                className="h-12 border-2 font-bold"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase ml-1 opacity-60">Message détaillé</Label>
              <Textarea 
                placeholder="Expliquez-nous tout..." 
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="border-2 font-medium min-h-[120px]"
                required
              />
            </div>
            <Button type="submit" disabled={isSending} className="w-full h-14 font-black uppercase tracking-widest gap-2 shadow-lg">
              <Send className="size-5" /> {isSending ? "Envoi..." : "Envoyer mon ticket"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2 px-1">
          <Clock className="size-4" /> Historique des tickets
        </h3>

        {tickets && tickets.length > 0 ? (
          <div className="grid gap-3">
            {tickets.map(t => (
              <Card key={t.id} className="border-2 shadow-sm">
                <CardHeader className="p-4 pb-2">
                  <div className="flex justify-between items-start">
                    <Badge variant={t.statut === 'ouvert' ? 'default' : 'secondary'} className="text-[8px] font-black uppercase px-2 h-5">
                      {t.statut}
                    </Badge>
                    <span className="text-[9px] font-bold opacity-40">
                      {t.createdAt ? format(t.createdAt.toDate(), 'dd/MM/yy HH:mm', { locale: fr }) : '...'}
                    </span>
                  </div>
                  <CardTitle className="text-sm font-black uppercase mt-2">{t.sujet}</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-3">
                  <p className="text-[11px] leading-relaxed text-muted-foreground line-clamp-2 italic">"{t.description}"</p>
                  
                  {t.adminResponse && (
                    <div className="p-3 bg-primary/5 border-2 border-primary/10 rounded-xl space-y-1 animate-in fade-in zoom-in-95">
                      <p className="text-[9px] font-black uppercase text-primary flex items-center gap-1">
                        <CheckCircle2 className="size-3" /> Réponse de l'expert
                      </p>
                      <p className="text-[11px] font-bold leading-relaxed">{t.adminResponse}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-10 border-2 border-dashed rounded-3xl opacity-30">
            <AlertCircle className="size-8 mx-auto mb-2" />
            <p className="text-[10px] font-black uppercase tracking-widest">Aucun ticket ouvert</p>
          </div>
        )}
      </div>
    </div>
  );
}
