
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
  Eye, Music, Volume2, Play, Download, HelpCircle, MessageSquare, Check, X
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

export default function AdminPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState('overview');
  
  const [tokenDuration, setTokenDuration] = useState('1');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [splashMode, setSplashMode] = useState<'text' | 'image'>('text');
  const [splashText, setSplashText] = useState('Lagon & Brousse NC');
  const [splashBgColor, setSplashBgColor] = useState('#3b82f6');
  const [splashDuration, setSplashDuration] = useState(3);
  const [isSavingSplash, setIsSavingSplash] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);

  // FAQ States
  const [isFaqDialogOpen, setIsFaqDialogOpen] = useState(false);
  const [currentFaq, setCurrentFaq] = useState<Partial<FaqEntry>>({});
  const [isSavingFaq, setIsSavingFaq] = useState(false);

  // Tickets States
  const [currentTicket, setCurrentTicket] = useState<SupportTicket | null>(null);
  const [adminResponse, setAdminResponse] = useState('');
  const [isResponding, setIsResponding] = useState(false);

  const isAdmin = useMemo(() => {
    const email = user?.email?.toLowerCase();
    return email === 'f.mallet81@outlook.com' || 
           email === 'f.mallet81@gmail.com' || 
           email === 'fabrice.mallet@gmail.com';
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
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      {isPreviewing && <SplashScreen settings={{ splashMode, splashText, splashBgColor, splashDuration }} isExiting={false} />}

      <Card className="border-2 shadow-sm">
        <CardHeader><CardTitle className="font-black uppercase tracking-tighter">Tableau de Bord Admin</CardTitle></CardHeader>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 sm:grid-cols-8 mb-6 h-auto p-1 bg-muted/50 border rounded-xl">
          <TabsTrigger value="overview">Stats</TabsTrigger>
          <TabsTrigger value="faq">FAQ</TabsTrigger>
          <TabsTrigger value="tickets">Tickets</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="design">Design</TabsTrigger>
          <TabsTrigger value="fish">Fish</TabsTrigger>
          <TabsTrigger value="sounds">Sons</TabsTrigger>
          <TabsTrigger value="access">Accès</TabsTrigger>
        </TabsList>

        <TabsContent value="faq" className="space-y-6">
          <Card className="border-2">
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 font-black uppercase text-sm"><HelpCircle className="size-4" /> FAQ Dynamique</CardTitle>
              <Button size="sm" onClick={() => { setCurrentFaq({ categorie: 'General', ordre: 0 }); setIsFaqDialogOpen(true); }} className="text-[10px] uppercase font-black"><Plus className="size-3 mr-1" /> Ajouter</Button>
            </CardHeader>
            <CardContent className="p-0 border-t">
              <Table>
                <TableHeader><TableRow><TableHead>Question</TableHead><TableHead>Catégorie</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
                <TableBody>
                  {faqs?.map(f => (
                    <TableRow key={f.id}>
                      <TableCell className="font-bold text-xs">{f.question}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[8px] uppercase">{f.categorie}</Badge></TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="size-8" onClick={() => { setCurrentFaq(f); setIsFaqDialogOpen(true); }}><Pencil className="size-3" /></Button>
                          <Button variant="ghost" size="icon" className="size-8" onClick={() => handleDeleteFaq(f.id)}><Trash2 className="size-3 text-destructive" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
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
                <TableHeader><TableRow><TableHead>Utilisateur</TableHead><TableHead>Sujet</TableHead><TableHead>Statut</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
                <TableBody>
                  {tickets?.map(t => (
                    <TableRow key={t.id} className={cn(t.statut === 'ouvert' && "bg-primary/5")}>
                      <TableCell className="text-[10px] font-bold">{t.userEmail}</TableCell>
                      <TableCell className="text-[10px] font-black uppercase">{t.sujet}</TableCell>
                      <TableCell><Badge variant={t.statut === 'ouvert' ? 'default' : 'secondary'} className="text-[8px] uppercase">{t.statut}</Badge></TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" className="h-8 text-[9px] uppercase font-black" onClick={() => { setCurrentTicket(t); setAdminResponse(t.adminResponse || ''); }}>Répondre</Button>
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
            <div className="space-y-1"><Label className="text-xs uppercase font-bold opacity-60">Réponse</Label><Textarea value={currentFaq.reponse || ''} onChange={e => setCurrentFaq({...currentFaq, reponse: e.target.value})} /></div>
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
          <DialogFooter><Button onClick={handleSaveFaq} disabled={isSavingFaq} className="w-full h-12 font-black uppercase">Sauvegarder</Button></DialogFooter>
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
          <DialogFooter><Button onClick={handleRespondToTicket} disabled={isResponding} className="w-full h-12 font-black uppercase">Envoyer & Fermer le ticket</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
