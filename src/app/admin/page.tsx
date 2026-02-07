
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, serverTimestamp, deleteDoc, doc, Timestamp, orderBy, query, setDoc, writeBatch, getDocs, addDoc, updateDoc } from 'firebase/firestore';
import type { UserAccount, AccessToken, Conversation, SharedAccessToken, SplashScreenSettings, FishSpeciesInfo, SoundLibraryEntry, FaqEntry, SupportTicket, CgvSettings } from '@/lib/types';
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
  Eye, Music, Volume2, Play, Download, HelpCircle, MessageSquare, Check, X, RefreshCw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
  FileText,
  Gavel
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { INITIAL_FAQ_DATA } from '@/lib/faq-data';

const FAQ_CATEGORIES = ["General", "Peche", "Boat Tracker", "Chasse", "Champs", "Compte"];

type SortConfig = {
  field: keyof FaqEntry | null;
  direction: 'asc' | 'desc';
};

export default function AdminPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState('overview');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  // FAQ States
  const [isFaqDialogOpen, setIsFaqDialogOpen] = useState(false);
  const [currentFaq, setCurrentFaq] = useState<Partial<FaqEntry>>({});
  const [isSavingFaq, setIsSavingFaq] = useState(false);
  const [faqSort, setFaqSort] = useState<SortConfig>({ field: null, direction: 'asc' });
  const [faqCategoryFilter, setFaqCategoryFilter] = useState<string>('all');

  // Tickets States
  const [currentTicket, setCurrentTicket] = useState<SupportTicket | null>(null);
  const [adminResponse, setAdminResponse] = useState('');
  const [isResponding, setIsResponding] = useState(false);

  // CGV States
  const [cgvContent, setCgvContent] = useState('');
  const [isSavingCgv, setIsSavingCgv] = useState(false);

  // Détection robuste admin (Email + UID)
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
    return query(collection(firestore, 'cms_support', 'faq', 'items'), orderBy('views', 'desc'));
  }, [firestore, isAdmin]);
  const { data: rawFaqs } = useCollection<FaqEntry>(faqRef);

  const sortedFaqs = useMemo(() => {
    if (!rawFaqs) return [];
    
    let filtered = [...rawFaqs];
    if (faqCategoryFilter !== 'all') {
      filtered = filtered.filter(f => f.categorie === faqCategoryFilter);
    }

    if (!faqSort.field) return filtered;

    return filtered.sort((a, b) => {
      const field = faqSort.field!;
      const valA = a[field] ?? '';
      const valB = b[field] ?? '';

      if (valA < valB) return faqSort.direction === 'asc' ? -1 : 1;
      if (valA > valB) return faqSort.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [rawFaqs, faqSort, faqCategoryFilter]);

  const handleSort = (field: keyof FaqEntry) => {
    setFaqSort(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const ticketsRef = useMemoFirebase(() => {
    if (!firestore || !isAdmin) return null;
    return query(collection(firestore, 'cms_support', 'tickets', 'items'), orderBy('createdAt', 'desc'));
  }, [firestore, isAdmin]);
  const { data: tickets } = useCollection<SupportTicket>(ticketsRef);

  const cgvRef = useMemoFirebase(() => {
    if (!firestore || !isAdmin) return null;
    return doc(firestore, 'app_settings', 'cgv');
  }, [firestore, isAdmin]);
  const { data: dbCgv } = useDoc<CgvSettings>(cgvRef);

  useEffect(() => {
    if (dbCgv) setCgvContent(dbCgv.content || '');
  }, [dbCgv]);

  // Handlers FAQ
  const handleSaveFaq = async () => {
    if (!firestore || !isAdmin || !currentFaq.question) return;
    setIsSavingFaq(true);
    try {
      const faqId = currentFaq.id || Math.random().toString(36).substring(7);
      await setDoc(doc(firestore, 'cms_support', 'faq', 'items', faqId), {
        ...currentFaq,
        id: faqId,
        views: currentFaq.views || 0,
        ordre: currentFaq.ordre || 0
      }, { merge: true });
      toast({ title: "FAQ mise à jour" });
      setIsFaqDialogOpen(false);
    } finally {
      setIsSavingFaq(false);
    }
  };

  const handleClearFaq = async () => {
    if (!firestore || !isAdmin || !rawFaqs) return;
    setIsClearing(true);
    try {
        const batch = writeBatch(firestore);
        rawFaqs.forEach(f => {
            batch.delete(doc(firestore, 'cms_support', 'faq', 'items', f.id));
        });
        await batch.commit();
        toast({ title: "FAQ vidée avec succès." });
    } catch (e) {
        toast({ variant: 'destructive', title: "Erreur lors de la suppression" });
    } finally {
        setIsClearing(false);
    }
  };

  const handleSeedFaq = async () => {
    if (!firestore || !isAdmin) return;
    if (rawFaqs && rawFaqs.length > 0) {
        toast({ variant: 'destructive', title: "Action annulée", description: "Videz d'abord la FAQ pour injecter les 100 nouvelles questions." });
        return;
    }
    setIsGenerating(true);
    try {
        const batch = writeBatch(firestore);
        INITIAL_FAQ_DATA.forEach(item => {
            const id = Math.random().toString(36).substring(7);
            const ref = doc(firestore, 'cms_support', 'faq', 'items', id);
            batch.set(ref, { ...item, id, views: 0 });
        });
        await batch.commit();
        toast({ title: "FAQ peuplée avec succès (100 entrées) !" });
    } catch (e) {
        toast({ variant: 'destructive', title: "Erreur lors de l'injection" });
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

  // Handlers CGV
  const handleSaveCgv = async () => {
    if (!firestore || !isAdmin) return;
    setIsSavingCgv(true);
    try {
      const newVersion = Date.now();
      await setDoc(doc(firestore, 'app_settings', 'cgv'), {
        content: cgvContent,
        updatedAt: serverTimestamp(),
        version: newVersion
      });
      toast({ title: "CGV sauvegardées !", description: `Version ${newVersion} active.` });
    } catch (e) {
      toast({ variant: 'destructive', title: "Erreur lors de la sauvegarde" });
    } finally {
      setIsSavingCgv(false);
    }
  };

  const loadCgvTemplate = () => {
    const today = new Date().toLocaleDateString('fr-FR');
    const template = `CONDITIONS GÉNÉRALES DE VENTE (CGV) - LAGON & BROUSSE NC
Dernière mise à jour : ${today}

ARTICLE 1 : OBJET
Les présentes CGV régissent l'accès et l'utilisation de l'application mobile "Lagon & Brousse NC", un service d'assistance maritime (marées, vent, suivi GPS) et agricole (calendrier lunaire, conseils IA).

ARTICLE 2 : IDENTIFICATION DE L'ÉDITEUR
L'application est éditée par Fabrice MALLET, domicilié en Nouvelle-Calédonie. Contact support : via l'interface de l'application ou l'onglet FAQ & Support.

ARTICLE 3 : SERVICES ET ABONNEMENT
L'accès au service est structuré comme suit :
- Période d'essai gratuite : 3 mois à compter de la création du compte.
- Version Limitée : Accès restreint à 1 minute par jour après l'essai si aucun abonnement n'est actif.
- Abonnement Premium : Accès illimité pour un montant de 500 Francs CFP (environ 4,19 €) par mois.

ARTICLE 4 : PRIX ET PAIEMENT
Les prix sont indiqués en Francs CFP et/ou Euros. Le paiement s'effectue via les systèmes sécurisés PayPal ou les systèmes de facturation intégrés des plateformes mobiles. L'abonnement est renouvelable tacitement sauf résiliation par l'utilisateur via son interface de paiement.

ARTICLE 5 : DROIT DE RÉTRACTATION
Conformément à la réglementation calédonienne sur les contenus numériques fournis sur support immatériel (Loi n° 2017-10), l'utilisateur accepte expressément l'exécution immédiate du service dès validation de l'abonnement et renonce ainsi à son droit de rétractation de 14 jours pour bénéficier des données en temps réel.

ARTICLE 6 : RESPONSABILITÉ ET SÉCURITÉ MARITIME
L'utilisateur reconnaît expressément que :
1. Les données fournies (marées, météo, vent, houle) sont issues de modèles mathématiques et ne remplacent en aucun cas les sources officielles (Météo France NC, SHOM).
2. Le Boat Tracker est un outil de confort et ne constitue pas un système de secours agréé (La VHF canal 16 reste prioritaire).
L'éditeur décline toute responsabilité en cas d'accident maritime, de dommage matériel ou corporel lié à une mauvaise interprétation des données.

ARTICLE 7 : PROTECTION DES DONNÉES
Les données collectées (Email, Surnom, GPS lors de l'activation des trackers) sont nécessaires au fonctionnement du service et sont stockées de manière sécurisée via Firebase. Aucune donnée n'est revendue à des tiers.

ARTICLE 8 : LOI APPLICABLE ET JURIDICTION
Les présentes CGV sont soumises au droit en vigueur en Nouvelle-Calédonie. Tout litige relatif à leur interprétation ou exécution sera de la compétence exclusive des tribunaux de Nouméa.`;
    setCgvContent(template);
    toast({ title: "Modèle chargé", description: "Vérifiez le texte avant de sauvegarder." });
  };

  useEffect(() => {
    if (!isUserLoading && !isAdmin) router.push('/compte');
  }, [isAdmin, isUserLoading, router]);

  if (isUserLoading || !isAdmin) return <div className="p-8"><Skeleton className="h-48 w-full" /></div>;

  const SortIcon = ({ field }: { field: keyof FaqEntry }) => {
    if (faqSort.field !== field) return <ArrowUpDown className="ml-1 size-3 opacity-20" />;
    return faqSort.direction === 'asc' ? <ArrowUp className="ml-1 size-3 text-primary" /> : <ArrowDown className="ml-1 size-3 text-primary" />;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 px-1">
      <Card className="border-2 shadow-sm">
        <CardHeader><CardTitle className="font-black uppercase tracking-tighter text-xl">Tableau de Bord Admin</CardTitle></CardHeader>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 sm:grid-cols-9 mb-6 h-auto p-1 bg-muted/50 border rounded-xl">
          <TabsTrigger value="overview" className="text-[10px] font-black uppercase">Stats</TabsTrigger>
          <TabsTrigger value="faq" className="text-[10px] font-black uppercase">FAQ</TabsTrigger>
          <TabsTrigger value="tickets" className="text-[10px] font-black uppercase">Tickets</TabsTrigger>
          <TabsTrigger value="cgv" className="text-[10px] font-black uppercase">CGV</TabsTrigger>
          <TabsTrigger value="users" className="text-[10px] font-black uppercase">Users</TabsTrigger>
          <TabsTrigger value="design" className="text-[10px] font-black uppercase">Design</TabsTrigger>
          <TabsTrigger value="fish" className="text-[10px] font-black uppercase">Fish</TabsTrigger>
          <TabsTrigger value="sounds" className="text-[10px] font-black uppercase">Sons</TabsTrigger>
          <TabsTrigger value="access" className="text-[10px] font-black uppercase">Accès</TabsTrigger>
        </TabsList>

        <TabsContent value="faq" className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <Button className="flex-1 h-12 font-black uppercase text-[10px] tracking-widest gap-2" onClick={() => { setCurrentFaq({ categorie: 'General', ordre: 0, views: 0 }); setIsFaqDialogOpen(true); }}>
                <Plus className="size-4" /> Ajouter Manuellement
            </Button>
            <Button variant="outline" className="flex-1 h-12 font-black uppercase text-[10px] tracking-widest gap-2 border-primary/20 bg-primary/5" onClick={handleSeedFaq} disabled={isGenerating || (rawFaqs && rawFaqs.length > 0)}>
                {isGenerating ? <RefreshCw className="size-4 animate-spin" /> : <DatabaseZap className="size-4 text-primary" />}
                Peupler FAQ (100 Auto)
            </Button>
            
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="flex-1 h-12 font-black uppercase text-[10px] tracking-widest gap-2" disabled={isClearing || !rawFaqs || rawFaqs.length === 0}>
                        <Trash2 className="size-4" /> Vider la FAQ ({rawFaqs?.length || 0})
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Êtes-vous sûr ?</AlertDialogTitle>
                        <AlertDialogDescription>Cette action supprimera TOUTES les questions de la base de connaissances. Cette action est irréversible.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction onClick={handleClearFaq} className="bg-destructive text-white">Confirmer la suppression</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
          </div>

          <Card className="border-2">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <CardTitle className="flex items-center gap-2 font-black uppercase text-sm">
                <HelpCircle className="size-4" /> Base de connaissances ({sortedFaqs.length})
              </CardTitle>
              <div className="flex items-center gap-2 min-w-[200px]">
                <Filter className="size-3 text-muted-foreground" />
                <Select value={faqCategoryFilter} onValueChange={setFaqCategoryFilter}>
                  <SelectTrigger className="h-9 text-[10px] font-black uppercase bg-muted/30 border-2">
                    <SelectValue placeholder="Catégorie..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-[10px] font-black uppercase">Toutes les catégories</SelectItem>
                    {FAQ_CATEGORIES.map(cat => (
                      <SelectItem key={cat} value={cat} className="text-[10px] font-black uppercase">{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-0 border-t">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead 
                      className="text-[10px] font-black uppercase cursor-pointer hover:text-primary transition-colors"
                      onClick={() => handleSort('question')}
                    >
                      <div className="flex items-center">Question <SortIcon field="question" /></div>
                    </TableHead>
                    <TableHead 
                      className="text-[10px] font-black uppercase cursor-pointer hover:text-primary transition-colors"
                      onClick={() => handleSort('views')}
                    >
                      <div className="flex items-center">Vues <SortIcon field="views" /></div>
                    </TableHead>
                    <TableHead 
                      className="text-[10px] font-black uppercase cursor-pointer hover:text-primary transition-colors"
                      onClick={() => handleSort('categorie')}
                    >
                      <div className="flex items-center">Catégorie <SortIcon field="categorie" /></div>
                    </TableHead>
                    <TableHead className="text-right text-[10px] font-black uppercase">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedFaqs.map(f => (
                    <TableRow key={f.id}>
                      <TableCell className="font-bold text-xs max-w-[200px] truncate">{f.question}</TableCell>
                      <TableCell><Badge variant="secondary" className="text-[8px] font-black">{f.views || 0}</Badge></TableCell>
                      <TableCell><Badge variant="outline" className="text-[8px] uppercase font-black">{f.categorie}</Badge></TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="size-8" onClick={() => { setCurrentFaq(f); setIsFaqDialogOpen(true); }}><Pencil className="size-3" /></Button>
                          <Button variant="ghost" size="icon" className="size-8" onClick={() => handleDeleteFaq(f.id)}><Trash2 className="size-3 text-destructive" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {sortedFaqs.length === 0 && (
                      <TableRow><TableCell colSpan={4} className="text-center py-10 italic text-muted-foreground">Aucune entrée trouvée. Essayez de vider les filtres.</TableCell></TableRow>
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

        <TabsContent value="cgv" className="space-y-6">
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-black uppercase text-sm">
                <FileText className="size-4" /> Conditions Générales de Vente
              </CardTitle>
              <CardDescription className="text-xs uppercase font-bold">Modifiez ici le texte légal. Toute sauvegarde forcera les utilisateurs à re-valider le document à leur prochaine connexion.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-muted/20 p-3 rounded-lg border-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase opacity-60">Version actuelle :</span>
                  <Badge variant="outline" className="font-black">{dbCgv?.version || 'Aucune'}</Badge>
                </div>
                <Button variant="outline" size="sm" className="h-8 text-[9px] font-black uppercase gap-2 border-primary/20" onClick={loadCgvTemplate}>
                  <Gavel className="size-3 text-primary" /> Charger le modèle conforme NC
                </Button>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase ml-1 opacity-60">Texte légal</Label>
                <Textarea 
                  value={cgvContent} 
                  onChange={e => setCgvContent(e.target.value)} 
                  className="min-h-[400px] font-medium leading-relaxed border-2" 
                  placeholder="Rédigez vos CGV ici..."
                />
              </div>
              <Button onClick={handleSaveCgv} disabled={isSavingCgv} className="w-full h-12 font-black uppercase tracking-widest gap-2">
                {isSavingCgv ? <RefreshCw className="size-4 animate-spin" /> : <Save className="size-4" />}
                Enregistrer & Publier la mise à jour
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-2"><CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-muted-foreground">Tickets Ouverts</CardTitle></CardHeader><CardContent><div className="text-2xl font-black">{tickets?.filter(t => t.statut === 'ouvert').length || 0}</div></CardContent></Card>
            <Card className="border-2"><CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-muted-foreground">FAQ Items</CardTitle></CardHeader><CardContent><div className="text-2xl font-black">{rawFaqs?.length || 0}</div></CardContent></Card>
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
