
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, serverTimestamp, deleteDoc, doc, Timestamp, orderBy, query, setDoc, writeBatch, getDocs, addDoc, updateDoc } from 'firebase/firestore';
import type { UserAccount, AccessToken, Conversation, SharedAccessToken, SplashScreenSettings, FishSpeciesInfo, SoundLibraryEntry, FaqEntry, SupportTicket } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { 
  DollarSign, Users, Crown, KeyRound, Trash2, Mail, 
  Palette, Save, Upload, 
  Fish, Plus, Minus, Pencil, DatabaseZap, Sparkles, UserX,
  Eye, Music, Volume2, Play, Download, HelpCircle, MessageSquare, Check, X, RefreshCw
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Slider } from '@/components/ui/slider';
import Link from 'next/link';
import Image from 'next/image';
import { lagoonFishData } from '@/lib/fish-data';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { format, isBefore, addDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { SplashScreen } from '@/components/splash-screen';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { generateFishInfo } from '@/ai/flows/generate-fish-info-flow';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const FAQ_CATEGORIES = ["General", "Peche", "Boat Tracker", "Chasse", "Champs", "Compte"];

const INITIAL_FAQ_DATA = [
  { categorie: "General", ordre: 1, question: "L'application remplace-t-elle les sources officielles ?", reponse: "Non. Pour votre sécurité, consultez toujours meteo.nc et les autorités maritimes (COSS). L'app est un assistant d'aide à la décision tactique, pas une source de sécurité légale." },
  { categorie: "General", ordre: 2, question: "Pourquoi l'application demande-t-elle ma position ?", reponse: "Pour vous fournir la météo de votre commune exacte, calculer les marées de la station la plus proche et permettre le fonctionnement en temps réel du Boat Tracker." },
  { categorie: "Boat Tracker", ordre: 3, question: "Mon contact reçoit-il ma position automatiquement ?", reponse: "Oui, tant que le mode Émetteur est actif et que vous avez une connexion internet (3G/4G). Votre contact doit utiliser le mode Récepteur avec votre ID unique." },
  { categorie: "Boat Tracker", ordre: 4, question: "Que contient le SMS d'urgence ?", reponse: "Votre surnom de navire, votre message de détresse (personnalisé ou standard), le type d'alerte (MAYDAY/PAN PAN) et un lien Google Maps direct vers votre position GPS." },
  { categorie: "Peche", ordre: 5, question: "Comment utiliser l'IA 'Jour Similaire' ?", reponse: "Enregistrez un spot après une belle prise. Plus tard, cliquez sur 'Jour Similaire' : l'IA cherchera dans les 14 prochains jours la date où la marée et la lune sont identiques à ce succès passé." },
  { categorie: "Peche", ordre: 6, question: "Les marées sont-elles précises pour tout le territoire ?", reponse: "L'app utilise les 7 stations de référence du SHOM en NC. Les horaires sont ajustés selon la commune sélectionnée pour une précision maximale dans le lagon." },
  { categorie: "Chasse", ordre: 7, question: "Pourquoi le vent est-il crucial pour la chasse ?", reponse: "Le cerf a l'odorat très sensible. L'app vous montre la provenance du vent pour vous aider à approcher 'à bon vent' (vent dans votre visage) sans être détecté." },
  { categorie: "Chasse", ordre: 8, question: "Comment inviter des amis dans une session ?", reponse: "Créez une session de groupe, notez le code (ex: CH-1234) et donnez-le à vos partenaires. Ils pourront alors rejoindre la carte tactique commune." },
  { categorie: "Champs", ordre: 9, question: "Comment est calculé l'arrosage au jet (en secondes) ?", reponse: "L'IA estime le besoin en eau en Litres selon la plante et la météo locale, puis convertit ce volume en secondes basé sur un débit standard de jet d'eau (12L/min)." },
  { categorie: "Champs", ordre: 10, question: "C'est quoi un 'Jour Fruits' ou 'Jour Racines' ?", reponse: "C'est l'influence du zodiaque sur la plante. On sème les tomates en jour Fruits et les carottes en jour Racines pour optimiser la vigueur et le rendement naturellement." },
  { categorie: "Compte", ordre: 11, question: "Puis-je utiliser l'app sur plusieurs téléphones ?", reponse: "Oui, connectez-vous simplement avec le même email. Vos spots, votre inventaire jardin et vos réglages sont synchronisés via votre compte Cloud." },
  { categorie: "Compte", ordre: 12, question: "Qu'est-ce que le mode 'Limité' ?", reponse: "Si votre abonnement n'est pas actif, vous disposez d'une minute d'accès par jour pour des consultations rapides. L'abonnement Premium débloque l'accès illimité." }
];

export default function AdminPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState('overview');
  const [isGenerating, setIsGenerating] = useState(false);

  // FAQ States
  const [isFaqDialogOpen, setIsFaqDialogOpen] = useState(false);
  const [currentFaq, setCurrentFaq] = useState<Partial<FaqEntry>>({});
  const [isSavingFaq, setIsSavingFaq] = useState(false);

  // Tickets States
  const [currentTicket, setCurrentTicket] = useState<SupportTicket | null>(null);
  const [adminResponse, setAdminResponse] = useState('');
  const [isResponding, setIsResponding] = useState(false);

  const isAdmin = useMemo(() => {
    if (!user) return false;
    const email = user.email?.toLowerCase();
    const uid = user.uid;
    return email === 'f.mallet81@outlook.com' || 
           email === 'f.mallet81@gmail.com' || 
           email === 'fabrice.mallet@gmail.com' ||
           uid === 'K9cVYLVUk1NV99YV3anebkugpPp1';
  }, [user]);

  // Queries
  const faqRef = useMemoFirebase(() => {
    if (!firestore || !isAdmin) return null;
    return query(collection(firestore, 'cms_support', 'faq', 'items'), orderBy('ordre', 'asc'));
  }, [firestore, isAdmin]);
  const { data: faqs } = useCollection<FaqEntry>(faqRef);

  const ticketsRef = useMemoFirebase(() => {
    if (!firestore || !isAdmin) return null;
    return query(collection(firestore, 'cms_support', 'tickets', 'items'), orderBy('createdAt', 'desc'));
  }, [firestore, isAdmin]);
  const { data: tickets } = useCollection<SupportTicket>(ticketsRef);

  // Handlers FAQ
  const handleSaveFaq = async () => {
    if (!firestore || !isAdmin || !currentFaq.question) return;
    setIsSavingFaq(true);
    try {
      const faqId = currentFaq.id || Math.random().toString(36).substring(7);
      await setDoc(doc(firestore, 'cms_support', 'faq', 'items', faqId), {
        ...currentFaq,
        id: faqId,
        ordre: currentFaq.ordre || 0
      }, { merge: true });
      toast({ title: "FAQ mise à jour" });
      setIsFaqDialogOpen(false);
    } finally {
      setIsSavingFaq(false);
    }
  };

  const handleSeedFaq = async () => {
    if (!firestore || !isAdmin) return;
    if (faqs && faqs.length > 0) {
        toast({ variant: 'destructive', title: "Action annulée", description: "La FAQ n'est pas vide." });
        return;
    }
    setIsGenerating(true);
    try {
        const batch = writeBatch(firestore);
        INITIAL_FAQ_DATA.forEach(item => {
            const id = Math.random().toString(36).substring(7);
            const ref = doc(firestore, 'cms_support', 'faq', 'items', id);
            batch.set(ref, { ...item, id });
        });
        await batch.commit();
        toast({ title: "FAQ peuplée avec succès !" });
    } catch (e) {
        toast({ variant: 'destructive', title: "Erreur" });
    } finally {
        setIsGenerating(false);
    }
  };

  const handleDeleteFaq = async (id: string) => {
    if (!firestore || !isAdmin) return;
    await deleteDoc(doc(firestore, 'cms_support', 'faq', 'items', id));
    toast({ title: "Entrée supprimée" });
  };

  // Handlers Tickets
  const handleRespondToTicket = async () => {
    if (!firestore || !isAdmin || !currentTicket || !adminResponse) return;
    setIsResponding(true);
    try {
      await updateDoc(doc(firestore, 'cms_support', 'tickets', 'items', currentTicket.id), {
        adminResponse,
        respondedAt: serverTimestamp(),
        statut: 'ferme'
      });
      toast({ title: "Réponse envoyée" });
      setCurrentTicket(null);
      setAdminResponse('');
    } finally {
      setIsResponding(false);
    }
  };

  useEffect(() => {
    if (!isUserLoading && !isAdmin) router.push('/compte');
  }, [isAdmin, isUserLoading, router]);

  if (isUserLoading || !isAdmin) return <div className="p-8"><Skeleton className="h-48 w-full" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 px-1">
      <Card className="border-2 shadow-sm">
        <CardHeader><CardTitle className="font-black uppercase tracking-tighter">Tableau de Bord Admin</CardTitle></CardHeader>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 sm:grid-cols-8 mb-6 h-auto p-1 bg-muted/50 border rounded-xl">
          <TabsTrigger value="overview" className="text-[10px] font-black uppercase">Stats</TabsTrigger>
          <TabsTrigger value="faq" className="text-[10px] font-black uppercase">FAQ</TabsTrigger>
          <TabsTrigger value="tickets" className="text-[10px] font-black uppercase">Tickets</TabsTrigger>
          <TabsTrigger value="users" className="text-[10px] font-black uppercase">Users</TabsTrigger>
          <TabsTrigger value="design" className="text-[10px] font-black uppercase">Design</TabsTrigger>
          <TabsTrigger value="fish" className="text-[10px] font-black uppercase">Fish</TabsTrigger>
          <TabsTrigger value="sounds" className="text-[10px] font-black uppercase">Sons</TabsTrigger>
          <TabsTrigger value="access" className="text-[10px] font-black uppercase">Accès</TabsTrigger>
        </TabsList>

        <TabsContent value="faq" className="space-y-6">
          <div className="flex gap-2 mb-4">
            <Button className="flex-1 h-12 font-black uppercase text-[10px] tracking-widest gap-2" onClick={() => { setCurrentFaq({ categorie: 'General', ordre: 0 }); setIsFaqDialogOpen(true); }}>
                <Plus className="size-4" /> Ajouter Manuellement
            </Button>
            <Button variant="outline" className="flex-1 h-12 font-black uppercase text-[10px] tracking-widest gap-2 border-primary/20 bg-primary/5" onClick={handleSeedFaq} disabled={isGenerating || (faqs && faqs.length > 0)}>
                {isGenerating ? <RefreshCw className="size-4 animate-spin" /> : <DatabaseZap className="size-4 text-primary" />}
                Peupler FAQ (Auto)
            </Button>
          </div>

          <Card className="border-2">
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 font-black uppercase text-sm"><HelpCircle className="size-4" /> Base de connaissances ({faqs?.length || 0})</CardTitle>
            </CardHeader>
            <CardContent className="p-0 border-t">
              <Table>
                <TableHeader><TableRow><TableHead className="text-[10px] font-black uppercase">Question</TableHead><TableHead className="text-[10px] font-black uppercase">Catégorie</TableHead><TableHead className="text-right text-[10px] font-black uppercase">Action</TableHead></TableRow></TableHeader>
                <TableBody>
                  {faqs?.map(f => (
                    <TableRow key={f.id}>
                      <TableCell className="font-bold text-xs max-w-[200px] truncate">{f.question}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[8px] uppercase font-black">{f.categorie}</Badge></TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="size-8" onClick={() => { setCurrentFaq(f); setIsFaqDialogOpen(true); }}><Pencil className="size-3" /></Button>
                          <Button variant="ghost" size="icon" className="size-8" onClick={() => handleDeleteFaq(f.id)}><Trash2 className="size-3 text-destructive" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {faqs?.length === 0 && (
                      <TableRow><TableCell colSpan={3} className="text-center py-10 italic text-muted-foreground">Aucune entrée. Utilisez le bouton "Peupler FAQ" pour démarrer.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tickets" className="space-y-6">
          <Card className="border-2">
            <CardHeader><CardTitle className="flex items-center gap-2 font-black uppercase text-sm"><MessageSquare className="size-4" /> Tickets Support</CardTitle></CardHeader>
            <CardContent className="p-0 border-t">
              <Table>
                <TableHeader><TableRow><TableHead className="text-[10px] font-black uppercase">Utilisateur</TableHead><TableHead className="text-[10px] font-black uppercase">Sujet</TableHead><TableHead className="text-[10px] font-black uppercase">Statut</TableHead><TableHead className="text-right text-[10px] font-black uppercase">Action</TableHead></TableRow></TableHeader>
                <TableBody>
                  {tickets?.map(t => (
                    <TableRow key={t.id} className={cn(t.statut === 'ouvert' && "bg-primary/5")}>
                      <TableCell className="text-[10px] font-bold">{t.userEmail}</TableCell>
                      <TableCell className="text-[10px] font-black uppercase">{t.sujet}</TableCell>
                      <TableCell><Badge variant={t.statut === 'ouvert' ? 'default' : 'secondary'} className="text-[8px] uppercase font-black">{t.statut}</Badge></TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" className="h-8 text-[9px] font-black uppercase" onClick={() => { setCurrentTicket(t); setAdminResponse(t.adminResponse || ''); }}>Répondre</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-2"><CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-muted-foreground">Tickets Ouverts</CardTitle></CardHeader><CardContent><div className="text-2xl font-black">{tickets?.filter(t => t.statut === 'ouvert').length || 0}</div></CardContent></Card>
            <Card className="border-2"><CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-muted-foreground">FAQ Items</CardTitle></CardHeader><CardContent><div className="text-2xl font-black">{faqs?.length || 0}</div></CardContent></Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialog FAQ */}
      <Dialog open={isFaqDialogOpen} onOpenChange={setIsFaqDialogOpen}>
        <DialogContent className="max-w-xl rounded-2xl">
          <DialogHeader><DialogTitle className="font-black uppercase">Éditer FAQ</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1"><Label className="text-xs uppercase font-bold opacity-60">Question</Label><Input value={currentFaq.question || ''} onChange={e => setCurrentFaq({...currentFaq, question: e.target.value})} /></div>
            <div className="space-y-1"><Label className="text-xs uppercase font-bold opacity-60">Réponse</Label><Textarea value={currentFaq.reponse || ''} onChange={e => setCurrentFaq({...currentFaq, reponse: e.target.value})} className="min-h-[120px]" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs uppercase font-bold opacity-60">Catégorie</Label>
                <Select value={currentFaq.categorie} onValueChange={(v:any) => setCurrentFaq({...currentFaq, categorie: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{FAQ_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label className="text-xs uppercase font-bold opacity-60">Ordre</Label><Input type="number" value={currentFaq.ordre || 0} onChange={e => setCurrentFaq({...currentFaq, ordre: parseInt(e.target.value)})} /></div>
            </div>
          </div>
          <DialogFooter><Button onClick={handleSaveFaq} disabled={isSavingFaq} className="w-full h-12 font-black uppercase shadow-lg">Sauvegarder</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Ticket Réponse */}
      <Dialog open={!!currentTicket} onOpenChange={(o) => !o && setCurrentTicket(null)}>
        <DialogContent className="max-w-xl rounded-2xl">
          <DialogHeader><DialogTitle className="font-black uppercase">Réponse Support</DialogTitle></DialogHeader>
          {currentTicket && (
            <div className="space-y-4 py-4">
              <div className="p-4 bg-muted/30 rounded-xl space-y-2">
                <p className="text-[10px] font-black uppercase opacity-60">Message de l'utilisateur :</p>
                <p className="text-xs font-bold leading-relaxed">"{currentTicket.description}"</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs uppercase font-bold opacity-60">Ma réponse</Label>
                <Textarea value={adminResponse} onChange={e => setAdminResponse(e.target.value)} className="min-h-[150px] border-2" placeholder="Tapez votre réponse ici..." />
              </div>
            </div>
          )}
          <DialogFooter><Button onClick={handleRespondToTicket} disabled={isResponding} className="w-full h-12 font-black uppercase shadow-lg bg-accent hover:bg-accent/90">Envoyer & Fermer le ticket</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
