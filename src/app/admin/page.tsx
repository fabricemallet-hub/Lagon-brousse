'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc, setDoc, addDoc, deleteDoc, serverTimestamp, Timestamp, updateDoc, writeBatch, where, getCountFromServer, getDoc, collectionGroup } from 'firebase/firestore';
import type { UserAccount, Business, Conversation, AccessToken, SharedAccessToken, SplashScreenSettings, CgvSettings, RibSettings, SystemNotification, FishSpeciesInfo, SoundLibraryEntry, SupportTicket, FishingSpot, Region, CampaignPricingSettings } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { 
  ShieldCheck, 
  Trash2, 
  Zap, 
  Ticket, 
  Sparkles,
  Search, 
  UserCog, 
  MessageSquare, 
  Users as UsersIcon, 
  Settings, 
  Bell, 
  Plus, 
  Save, 
  Smartphone, 
  Fish, 
  Pencil, 
  BrainCircuit, 
  X, 
  Store, 
  Link as LinkIcon, 
  Check, 
  RefreshCw, 
  Landmark, 
  ChevronRight, 
  UserCircle, 
  Copy, 
  Volume2, 
  Play, 
  Camera, 
  ImageIcon, 
  Clock, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  Calendar, 
  XCircle, 
  Maximize2, 
  ScrollText, 
  UserPlus, 
  Ruler,
  Download,
  Map as MapIcon,
  MapPin,
  LocateFixed,
  Expand,
  Shrink,
  Anchor,
  Globe,
  Filter,
  Info,
  PlayCircle,
  DollarSign,
  Mail
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { cn, getDistance } from '@/lib/utils';
import { format, addDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import Link from 'next/link';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from '@/components/ui/alert-dialog';
import { generateFishInfo } from '@/ai/flows/generate-fish-info-flow';
import { locations, locationsByRegion, regions } from '@/lib/locations';
import { GoogleMap, OverlayView } from '@react-google-maps/api';
import { useGoogleMaps } from '@/context/google-maps-context';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const INITIAL_CENTER = { lat: -21.3, lng: 165.5 };

const fishingTypes = [
  { id: 'Dérive', label: 'Dérive' },
  { id: 'Mouillage', label: 'Mouillage' },
  { id: 'Pêche à la ligne', label: 'Ligne' },
  { id: 'Pêche au lancer', label: 'Lancer' },
  { id: 'Traine', label: 'Traîne' },
];

const getClosestCommune = (lat: number, lng: number) => {
    let closestName = 'Inconnue';
    let minDistance = Infinity;
    Object.entries(locations).forEach(([name, coords]) => {
        const dist = getDistance(lat, lng, coords.lat, coords.lon);
        if (dist < minDistance) {
            minDistance = dist;
            closestName = name;
        }
    });
    return closestName;
};

export default function AdminPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('stats');

  const isAdmin = useMemo(() => {
    if (!user) return false;
    const masterEmails = ['f.mallet81@outlook.com', 'f.mallet81@gmail.com', 'fabrice.mallet@gmail.com', 'kledostyle@hotmail.com', 'kledostyle@outlook.com'];
    const masterUids = ['t8nPnZLcTiaLJSKMuLzib3C5nPn1', 'D1q2GPM95rZi38cvCzvsjcWQDaV2', 'koKj5ObSGXYeO1PLKU5bgo8Yaky1'];
    return masterEmails.includes(user.email?.toLowerCase() || '') || masterUids.includes(user.uid);
  }, [user]);

  const usersRef = useMemoFirebase(() => (firestore && isAdmin) ? collection(firestore, 'users') : null, [firestore, isAdmin]);
  const { data: users, isLoading: isUsersLoading } = useCollection<UserAccount>(usersRef);

  const businessRef = useMemoFirebase(() => (firestore && isAdmin) ? query(collection(firestore, 'businesses'), orderBy('name', 'asc')) : null, [firestore, isAdmin]);
  const { data: businesses } = useCollection<Business>(businessRef);

  const convsRef = useMemoFirebase(() => (firestore && isAdmin) ? query(collection(firestore, 'conversations'), orderBy('lastMessageAt', 'desc')) : null, [firestore, isAdmin]);
  const { data: conversations, isLoading: isConvsLoading } = useCollection<Conversation>(convsRef);

  const ticketsRef = useMemoFirebase(() => (firestore && isAdmin) ? collection(firestore, 'cms_support', 'tickets', 'items') : null, [firestore, isAdmin]);
  const { data: rawTickets, isLoading: isTicketsLoading } = useCollection<SupportTicket>(ticketsRef);
  
  const tickets = useMemo(() => {
    if (!rawTickets) return null;
    return [...rawTickets].sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
  }, [rawTickets]);

  const tokensRef = useMemoFirebase(() => (firestore && isAdmin) ? query(collection(firestore, 'access_tokens'), orderBy('createdAt', 'desc')) : null, [firestore, isAdmin]);
  const { data: tokens } = useCollection<AccessToken>(tokensRef);

  const sharedTokenRef = useMemoFirebase(() => (firestore && isAdmin) ? doc(firestore, 'shared_access_tokens', 'GLOBAL') : null, [firestore, isAdmin]);
  const { data: globalGift } = useDoc<SharedAccessToken>(sharedTokenRef);

  useEffect(() => {
    if (!isUserLoading && !isAdmin && user) router.push('/compte');
  }, [isAdmin, isUserLoading, router, user]);

  if (isUserLoading) return <div className="p-4"><Skeleton className="h-64 w-full rounded-2xl" /></div>;
  if (!isAdmin) return <div className="p-12 text-center font-black uppercase text-muted-foreground animate-pulse">Accès Master Requis...</div>;

  return (
    <div className="w-full space-y-4 pb-32 px-1">
      <Card className="border-none shadow-lg bg-slate-900 text-white overflow-hidden relative rounded-2xl">
        <div className="absolute right-0 top-0 opacity-10 -translate-y-2 translate-x-2">
            <ShieldCheck className="size-20" />
        </div>
        <CardHeader className="py-6 px-5 relative z-10">
          <CardTitle className="font-black uppercase tracking-tighter text-2xl">Dashboard Master</CardTitle>
          <CardDescription className="text-slate-400 font-bold uppercase text-[9px] tracking-widest truncate">{user?.email}</CardDescription>
        </CardHeader>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="sticky top-[64px] z-30 bg-background/95 backdrop-blur-md -mx-1 px-2 py-3 border-b-2 border-primary/10 mb-4 overflow-x-auto scrollbar-hide">
          <TabsList className="flex w-max bg-transparent p-0 gap-2 h-auto justify-start">
            {[
              { id: 'stats', label: 'Stats' },
              { id: 'users', label: 'Comptes' },
              { id: 'businesses', label: 'Pros' },
              { id: 'fish', label: 'Poissons' },
              { id: 'sons', label: 'Sons' },
              { id: 'notifications', label: 'Alertes' },
              { id: 'settings', label: 'Réglages' },
              { id: 'pricing', label: 'Tarifs' },
              { id: 'acces', label: 'Accès' },
              { id: 'support', label: 'Support' },
              { id: 'spots', label: 'Spots GPS' }
            ].map(tab => (
              <TabsTrigger 
                key={tab.id} 
                value={tab.id} 
                className="shrink-0 text-[10px] font-black uppercase py-3 px-5 rounded-xl border-2 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:border-primary transition-all shadow-sm"
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <div className="space-y-6">
          <TabsContent value="stats">
            <div className="grid gap-3 grid-cols-2">
              <StatsCard title="Utilisateurs" value={users?.length || 0} icon={UsersIcon} color="text-slate-500" />
              <StatsCard title="Abonnés" value={users?.filter(u => u.subscriptionStatus === 'active' || u.subscriptionStatus === 'admin' || u.subscriptionStatus === 'professional').length || 0} icon={ShieldCheck} color="text-primary" />
              <StatsCard title="Boutiques" value={businesses?.length || 0} icon={Store} color="text-accent" />
              <StatsCard title="Messages" value={(conversations?.filter(c => !c.isReadByAdmin).length || 0) + (tickets?.filter(t => t.statut === 'ouvert').length || 0)} icon={MessageSquare} color="text-green-600" />
            </div>

            <div className="mt-8 space-y-4">
                <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2 px-1">
                    <Zap className="size-4 text-primary" /> Demandes en attente
                </h3>
                
                <div className="flex flex-col gap-3">
                    {conversations?.filter(c => !c.isReadByAdmin).slice(0, 3).map(c => (
                        <Link key={c.id} href={`/admin/messages/${c.id}`} className="p-4 border-2 border-primary bg-primary/5 rounded-2xl flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-left-2 transition-all active:scale-[0.98]">
                            <div className="min-w-0 flex-1">
                                <p className="font-black text-xs uppercase truncate text-slate-800">{c.userDisplayName}</p>
                                <p className="text-[10px] font-bold opacity-60 truncate italic mt-0.5">"{c.lastMessageContent}"</p>
                            </div>
                            <div className="flex flex-col items-end gap-1 shrink-0 ml-4">
                                <Badge className="bg-primary text-[8px] h-4 font-black uppercase">Chat</Badge>
                                <span className="text-[8px] font-black opacity-30 uppercase">{c.lastMessageAt ? format(c.lastMessageAt.toDate(), 'HH:mm') : '...'}</span>
                            </div>
                        </Link>
                    ))}

                    {tickets?.filter(t => t.statut === 'ouvert').slice(0, 3).map(t => (
                        <div key={t.id} onClick={() => setActiveTab('support')} className="p-4 border-2 border-orange-200 bg-orange-50/10 rounded-2xl flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-left-2 cursor-pointer transition-all active:scale-[0.98]">
                            <div className="min-w-0 flex-1">
                                <p className="font-black text-xs uppercase truncate text-orange-950">{t.sujet}</p>
                                <p className="text-[10px] font-bold opacity-60 truncate italic mt-0.5">"{t.description}"</p>
                            </div>
                            <div className="flex flex-col items-end gap-1 shrink-0 ml-4">
                                <Badge variant="outline" className="border-orange-300 text-orange-700 bg-white text-[8px] h-4 font-black uppercase">Ticket</Badge>
                                <span className="text-[8px] font-black opacity-30 uppercase">{t.createdAt ? format(t.createdAt.toDate(), 'HH:mm') : '...'}</span>
                            </div>
                        </div>
                    ))}

                    {(!conversations?.some(c => !c.isReadByAdmin) && !tickets?.some(t => t.statut === 'ouvert')) && (
                        <div className="p-12 text-center border-4 border-dashed rounded-[2.5rem] opacity-20 flex flex-col items-center gap-3">
                            <CheckCircle2 className="size-10" />
                            <p className="font-black uppercase tracking-[0.2em] text-[10px]">Toutes les demandes sont traitées</p>
                        </div>
                    )}
                </div>
            </div>
          </TabsContent>

          <TabsContent value="users" className="space-y-6">
            <PermissionsManager users={users} />
            <UsersManager users={users} />
          </TabsContent>

          <TabsContent value="businesses">
            <BusinessManager businesses={businesses} users={users} />
          </TabsContent>
          
          <TabsContent value="fish">
            <FishGuideManager />
          </TabsContent>

          <TabsContent value="sons">
            <SoundLibraryManager />
          </TabsContent>

          <TabsContent value="notifications">
            <SystemNotificationsManager />
          </TabsContent>

          <TabsContent value="settings">
            <AppSettingsManager />
          </TabsContent>

          <TabsContent value="pricing">
            <CampaignPricingManager />
          </TabsContent>

          <TabsContent value="acces">
            <div className="flex flex-col gap-6">
              <GlobalAccessManager globalGift={globalGift} />
              <TokenManager tokens={tokens} users={users} />
            </div>
          </TabsContent>

          <TabsContent value="support">
            <SupportManager 
                conversations={conversations} 
                isLoadingConvs={isConvsLoading}
                tickets={tickets}
                isLoadingTickets={isTicketsLoading}
            />
          </TabsContent>

          <TabsContent value="spots">
            <GlobalSpotsManager users={users} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

function StatsCard({ title, value, icon: Icon, color }: { title: string, value: number, icon: any, color: string }) {
  return (
    <Card className="border-2 shadow-sm overflow-hidden bg-white rounded-2xl">
      <CardHeader className="p-4 pb-1">
        <div className="flex items-center justify-between">
          <CardTitle className="text-[10px] font-black uppercase opacity-40 tracking-wider">{title}</CardTitle>
          <Icon className={cn("size-4 opacity-30", color)} />
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="text-2xl font-black">{value}</div>
      </CardContent>
    </Card>
  );
}

function GlobalSpotsManager({ users }: { users: UserAccount[] | null }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const { isLoaded, loadError } = useGoogleMaps();
    const [map, setMap] = useState<google.maps.Map | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [searchUser, setSearchUser] = useState('');
    const [selectedSpot, setSelectedSpot] = useState<FishingSpot | null>(null);
    
    // FILTRES
    const [filterRegion, setFilterRegion] = useState<string>('ALL');
    const [filterCommune, setFilterCommune] = useState<string>('ALL');
    const [filterType, setFilterType] = useState<string>('ALL');
    const [userLocation, setUserLocation] = useState<google.maps.LatLngLiteral | null>(null);

    const spotsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return collectionGroup(firestore, 'fishing_spots');
    }, [firestore]);

    const { data: allSpots, isLoading } = useCollection<FishingSpot>(spotsQuery);

    const userMap = useMemo(() => {
        const m = new Map<string, UserAccount>();
        users?.forEach(u => m.set(u.id, u));
        return m;
    }, [users]);

    const availableCommunes = useMemo(() => {
        if (filterRegion === 'ALL') return [];
        return Object.keys(locationsByRegion[filterRegion as Region] || {}).sort();
    }, [filterRegion]);

    const handleActivateGps = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((pos) => {
                const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                setUserLocation(p);
                map?.panTo(p);
                map?.setZoom(14);
                toast({ title: "GPS Activé", description: "Carte centrée sur votre position." });
            }, () => {
                toast({ variant: "destructive", title: "Erreur GPS", description: "Impossible de récupérer votre position." });
            });
        }
    };

    const filteredSpots = useMemo(() => {
        if (!allSpots) return [];
        return allSpots.filter(spot => {
            const owner = userMap.get(spot.userId);
            
            // Filtre Recherche
            const s = searchUser.toLowerCase();
            const matchesSearch = !searchUser.trim() || 
                   spot.name.toLowerCase().includes(s) || 
                   owner?.email?.toLowerCase().includes(s) || 
                   owner?.displayName?.toLowerCase().includes(s);
            if (!matchesSearch) return false;

            // Filtre Région
            if (filterRegion !== 'ALL') {
                const uReg = owner?.selectedRegion;
                if (uReg !== filterRegion) return false;
            }

            // Filtre Commune
            if (filterCommune !== 'ALL') {
                const spotCommune = getClosestCommune(spot.location.latitude, spot.location.longitude);
                if (spotCommune !== filterCommune) return false;
            }

            // Filtre Type
            if (filterType !== 'ALL') {
                if (!spot.fishingTypes?.includes(filterType)) return false;
            }

            return true;
        });
    }, [allSpots, searchUser, userMap, filterRegion, filterCommune, filterType]);

    if (loadError) return <Alert variant="destructive"><AlertTitle>Erreur Google Maps</AlertTitle></Alert>;
    if (!isLoaded) return <Skeleton className="h-96 w-full" />;

    return (
        <Card className="border-2 shadow-lg rounded-2xl overflow-hidden">
            <CardHeader className="p-5 border-b bg-muted/5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <CardTitle className="size-5 font-black uppercase flex items-center gap-2 text-primary"><MapIcon className="size-5" /> Cartographie des Points Utilisateurs</CardTitle>
                        <CardDescription className="text-[10px] font-bold uppercase mt-1">Surveillance globale des coins de pêche enregistrés ({filteredSpots.length} / {allSpots?.length || 0} points).</CardDescription>
                    </div>
                    <Button onClick={handleActivateGps} variant="outline" className="font-black uppercase text-[10px] h-10 border-2 gap-2 shadow-sm">
                        <LocateFixed className="size-4 text-primary" /> Activer mon GPS
                    </Button>
                </div>

                <div className="grid grid-cols-1 gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                        <Input 
                            placeholder="Chercher par nom de spot, email ou nom d'utilisateur..." 
                            value={searchUser} 
                            onChange={e => setSearchUser(e.target.value)} 
                            className="pl-10 h-12 border-2 font-bold text-xs bg-white" 
                        />
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1">
                            <Label className="text-[8px] font-black uppercase ml-1 opacity-40">Région</Label>
                            <Select value={filterRegion} onValueChange={(v) => { setFilterRegion(v); setFilterCommune('ALL'); }}>
                                <SelectTrigger className="h-9 text-[10px] font-black uppercase bg-white border-2">
                                    <Globe className="size-3 mr-1 text-primary" />
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL" className="text-[10px] font-black uppercase">Toutes</SelectItem>
                                    {regions.map(r => <SelectItem key={r} value={r} className="text-[10px] font-black uppercase">{r}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1">
                            <Label className="text-[8px] font-black uppercase ml-1 opacity-40">Commune</Label>
                            <Select value={filterCommune} onValueChange={setFilterCommune} disabled={filterRegion === 'ALL'}>
                                <SelectTrigger className="h-9 text-[10px] font-black uppercase bg-white border-2">
                                    <MapPin className="size-3 mr-1 text-primary" />
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="max-h-64">
                                    <SelectItem value="ALL" className="text-[10px] font-black uppercase">Toutes</SelectItem>
                                    {availableCommunes.map(c => <SelectItem key={c} value={c} className="text-[10px] font-black uppercase">{c}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1">
                            <Label className="text-[8px] font-black uppercase ml-1 opacity-40">Technique</Label>
                            <Select value={filterType} onValueChange={setFilterType}>
                                <SelectTrigger className="h-9 text-[10px] font-black uppercase bg-white border-2">
                                    <Filter className="size-3 mr-1 text-primary" />
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL" className="text-[10px] font-black uppercase">Toutes</SelectItem>
                                    {fishingTypes.map(t => <SelectItem key={t.id} value={t.id} className="text-[10px] font-black uppercase">{t.label}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div className={cn("relative w-full transition-all", isFullscreen ? "fixed inset-0 z-[100] h-screen w-screen" : "h-[500px]")}>
                    <GoogleMap
                        mapContainerClassName="w-full h-full"
                        defaultCenter={INITIAL_CENTER}
                        defaultZoom={7}
                        onLoad={setMap}
                        options={{ disableDefaultUI: false, mapTypeId: 'satellite', gestureHandling: 'greedy' }}
                    >
                        {userLocation && (
                            <OverlayView position={userLocation} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                                <div style={{ transform: 'translate(-50%, -50%)' }} className="size-6 bg-blue-500 border-4 border-white rounded-full shadow-lg animate-pulse" />
                            </OverlayView>
                        )}
                        {filteredSpots.map(spot => (
                            <OverlayView 
                                key={spot.id} 
                                position={{ lat: spot.location.latitude, lng: spot.location.longitude }} 
                                mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                            >
                                <div 
                                    style={{ transform: 'translate(-50%, -100%)' }} 
                                    className="flex flex-col items-center cursor-pointer group"
                                    onClick={() => setSelectedSpot(spot)}
                                >
                                    <div className="px-2 py-1 bg-white/90 backdrop-blur-sm border-2 rounded text-[8px] font-black uppercase shadow-lg mb-1 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                        {spot.name}
                                    </div>
                                    <div className="p-1.5 rounded-full border-2 border-white shadow-xl" style={{ backgroundColor: spot.color || '#3b82f6' }}>
                                        <Anchor className="size-3 text-white" />
                                    </div>
                                </div>
                            </OverlayView>
                        ))}
                    </GoogleMap>
                    
                    <div className="absolute top-4 right-4 flex flex-col gap-2">
                        <Button 
                            size="icon" 
                            className="bg-white/90 backdrop-blur-md border-2 shadow-xl hover:bg-white text-primary h-10 w-10"
                            onClick={() => setIsFullscreen(!isFullscreen)}
                        >
                            {isFullscreen ? <Shrink className="size-5" /> : <Expand className="size-5" />}
                        </Button>
                    </div>

                    {selectedSpot && (
                        <div className="absolute bottom-4 left-4 right-4 z-20 animate-in slide-in-from-bottom-4 duration-300">
                            <Card className="border-2 border-primary shadow-2xl overflow-hidden">
                                <CardHeader className="p-4 bg-primary text-white flex-row justify-between items-center space-y-0">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-white/20 rounded-lg"><Anchor className="size-5" /></div>
                                        <div>
                                            <CardTitle className="text-sm font-black uppercase leading-tight">{selectedSpot.name}</CardTitle>
                                            <CardDescription className="text-white/70 font-bold uppercase text-[8px]">Propriétaire : {userMap.get(selectedSpot.userId)?.displayName || 'Utilisateur inconnu'}</CardDescription>
                                        </div>
                                    </div>
                                    <button onClick={() => setSelectedSpot(null)} className="p-1 hover:bg-white/10 rounded-full"><X className="size-5" /></button>
                                </CardHeader>
                                <CardContent className="p-4 grid grid-cols-2 gap-4 bg-white">
                                    <div className="space-y-2">
                                        <div className="flex flex-col">
                                            <span className="text-[8px] font-black uppercase text-muted-foreground">Email Utilisateur</span>
                                            <span className="text-[10px] font-bold truncate">{userMap.get(selectedSpot.userId)?.email || selectedSpot.userId}</span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[8px] font-black uppercase text-muted-foreground">Coordonnées GPS</span>
                                            <span className="text-[10px] font-mono font-bold">{selectedSpot.location.latitude.toFixed(5)}, {selectedSpot.location.longitude.toFixed(5)}</span>
                                        </div>
                                    </div>
                                    <div className="space-y-2 border-l pl-4">
                                        <div className="flex flex-col">
                                            <span className="text-[8px] font-black uppercase text-muted-foreground">Marée & Lune</span>
                                            <span className="text-[10px] font-bold">{selectedSpot.context?.tideMovement} | {selectedSpot.context?.moonPhase}</span>
                                        </div>
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            {selectedSpot.fishingTypes?.map(t => (
                                                <Badge key={t} variant="outline" className="text-[7px] font-black uppercase h-4 border-primary/20 text-primary">{t}</Badge>
                                            ))}
                                        </div>
                                    </div>
                                    {selectedSpot.notes && (
                                        <div className="col-span-2 p-3 bg-muted/30 rounded-xl border border-dashed text-[10px] italic font-medium leading-relaxed">
                                            "{selectedSpot.notes}"
                                        </div>
                                    )}
                                </CardContent>
                                <CardFooter className="p-2 border-t bg-slate-50 flex justify-between">
                                    <span className="text-[8px] font-black uppercase opacity-40 italic">Enregistré le {selectedSpot.createdAt ? format(selectedSpot.createdAt.toDate(), 'dd/MM/yyyy HH:mm') : '...'}</span>
                                    <Button size="sm" variant="ghost" className="h-6 text-[8px] font-black uppercase text-primary gap-1" onClick={() => { map?.panTo({ lat: selectedSpot.location.latitude, lng: selectedSpot.location.longitude }); map?.setZoom(17); }}>Recentrer sur ce point <ChevronRight className="size-2" /></Button>
                                </CardFooter>
                            </Card>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

function SoundLibraryManager() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [label, setLabel] = useState('');
    const [url, setUrl] = useState('');
    const [categories, setCategories] = useState<string[]>(['General']);
    const [isSaving, setIsSaving] = useState(false);
    const audioInputRef = useRef<HTMLInputElement>(null);

    const handleAudioFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 800 * 1024) { 
            toast({ variant: 'destructive', title: "Fichier trop lourd", description: "Max 800Ko recommandé." });
            return;
        }
        const reader = new FileReader();
        reader.onload = (event) => {
            setUrl(event.target?.result as string);
            if (!label) setLabel(file.name.split('.')[0]);
            toast({ title: "Fichier audio prêt !" });
        };
        reader.readAsDataURL(file);
    };

    const soundsRef = useMemoFirebase(() => firestore ? query(collection(firestore, 'sound_library'), orderBy('label', 'asc')) : null, [firestore]);
    const { data: sounds } = useCollection<SoundLibraryEntry>(soundsRef);

    const handleSave = async () => {
        if (!firestore || !label || !url) return;
        setIsSaving(true);
        try {
            await addDoc(collection(firestore, 'sound_library'), {
                label,
                url,
                categories,
                createdAt: serverTimestamp()
            });
            setLabel('');
            setUrl('');
            toast({ title: "Son ajouté !" });
        } catch (e) {
            toast({ variant: 'destructive', title: "Erreur" });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!firestore) return;
        await deleteDoc(doc(firestore, 'sound_library', id));
        toast({ title: "Son supprimé" });
    };

    return (
        <Card className="border-2 shadow-lg overflow-hidden rounded-2xl">
            <CardHeader className="p-5 bg-muted/5 border-b">
                <CardTitle className="text-lg font-black uppercase flex items-center gap-2 text-primary"><Volume2 className="size-5" /> Bibliothèque Sonore</CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase mt-1">Gérez les sons pour le tracker et la chasse.</CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-6">
                <div className="grid gap-4 p-5 bg-muted/10 rounded-2xl border-2 border-dashed">
                    <div className="space-y-4">
                        <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase ml-1 opacity-60">Nom du son</Label><Input value={label} onChange={e => setLabel(e.target.value)} placeholder="Ex: Alerte, Bip..." className="h-12 border-2 font-bold" /></div>
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase ml-1 opacity-60">Fichier MP3 ou URL</Label>
                            <div className="flex gap-2">
                                <Input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." className="h-12 border-2 text-[10px] font-mono flex-1 bg-white" />
                                <Button variant="outline" className="h-12 w-12 border-2 shrink-0 bg-white" onClick={() => audioInputRef.current?.click()}>
                                    <Smartphone className="size-5" />
                                </Button>
                                <input type="file" accept="audio/*" ref={audioInputRef} className="hidden" onChange={handleAudioFileChange} />
                            </div>
                        </div>
                        <div className="space-y-2"><Label className="text-[10px] font-black uppercase ml-1 opacity-60">Catégories</Label>
                            <div className="flex flex-wrap gap-2">
                                {['Vessel', 'Hunting', 'General'].map(cat => (
                                    <Badge key={cat} variant={categories.includes(cat) ? "default" : "outline"} className="cursor-pointer font-black uppercase text-[9px] py-2 px-3 h-auto border-2" onClick={() => setCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat])}>{cat}</Badge>
                                ))}
                            </div>
                        </div>
                    </div>
                    <Button onClick={handleSave} disabled={isSaving || !label || !url} className="w-full h-14 font-black uppercase tracking-widest shadow-md"><Plus className="size-4 mr-2" /> Ajouter le son</Button>
                </div>
                <div className="space-y-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Sons enregistrés ({sounds?.length || 0})</p>
                    <div className="flex flex-col gap-2">
                        {sounds?.map(s => (
                            <div key={s.id} className="p-3 flex items-center justify-between border-2 rounded-xl bg-white shadow-sm">
                                <div className="flex flex-col min-w-0 pr-2">
                                    <span className="font-black uppercase text-xs truncate text-slate-800">{s.label}</span>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                        {s.categories?.map(c => <Badge key={c} variant="outline" className="text-[7px] h-3.5 px-1 uppercase font-black border-primary/20 text-primary">{c}</Badge>)}
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                    <Button variant="ghost" size="icon" className="h-10 w-10 border rounded-xl" onClick={() => { const a = new Audio(s.url); a.play(); }}><Play className="size-4" /></Button>
                                    <Button variant="ghost" size="icon" className="h-10 w-10 border rounded-xl text-primary/60 hover:text-primary" asChild>
                                        <a href={s.url} download={`${s.label}.mp3`} target="_blank" rel="noopener noreferrer">
                                            <Download className="size-4" />
                                        </a>
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-10 w-10 text-destructive/40 hover:text-destructive border rounded-xl" onClick={() => handleDelete(s.id)}><Trash2 className="size-4" /></Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function BusinessManager({ businesses, users }: { businesses: Business[] | null, users: UserAccount[] | null }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingBusiness, setEditingBusiness] = useState<Business | null>(null);
    
    const [name, setName] = useState('');
    const [commune, setCommune] = useState('Nouméa');
    const [ownerId, setOwnerId] = useState('');
    const [categories, setCategories] = useState<string[]>([]);
    
    // États pour la recherche d'utilisateur par email
    const [userSearch, setUserSearch] = useState('');
    const [isSearchOpen, setIsSearchOpen] = useState(false);

    const availableCats = ["Pêche", "Chasse", "Jardinage"];

    const filteredUsers = useMemo(() => {
        if (!users || userSearch.length < 2) return [];
        return users.filter(u => u.email.toLowerCase().includes(userSearch.toLowerCase())).slice(0, 5);
    }, [users, userSearch]);

    const handleSave = async () => {
        if (!firestore || !name || !ownerId) return;
        setIsSaving(true);
        const businessId = editingBusiness ? editingBusiness.id : `BUS-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        try {
            const batch = writeBatch(firestore);
            batch.set(doc(firestore, 'businesses', businessId), { id: businessId, name, commune, ownerId, categories, updatedAt: serverTimestamp() }, { merge: true });
            batch.update(doc(firestore, 'users', ownerId), { businessId: businessId, role: 'professional', subscriptionStatus: 'professional' });
            await batch.commit();
            toast({ title: "Boutique liée !" });
            setIsDialogOpen(false);
        } catch (e) { toast({ variant: 'destructive', title: "Erreur" }); } finally { setIsSaving(false); }
    };

    return (
        <Card className="border-2 shadow-lg rounded-2xl overflow-hidden">
            <CardHeader className="p-5 border-b bg-muted/5">
                <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-lg font-black uppercase flex items-center gap-2"><Store className="size-5 text-primary" /> Partenaires PRO</CardTitle>
                            <CardDescription className="text-[10px] font-bold uppercase mt-1">Liez un commerce via UID.</CardDescription>
                        </div>
                    </div>
                    <Button onClick={() => { setEditingBusiness(null); setName(''); setOwnerId(''); setCategories([]); setUserSearch(''); setIsDialogOpen(true); }} className="w-full font-black uppercase h-14 tracking-widest shadow-md"><Plus className="size-5 mr-2" /> Créer / Lier une boutique</Button>
                </div>
            </CardHeader>
            <CardContent className="p-3 space-y-3">
                {businesses?.map(b => (
                    <div key={b.id} className="flex flex-col p-4 border-2 rounded-2xl bg-white shadow-sm gap-4">
                        <div className="flex flex-col min-w-0">
                            <span className="font-black uppercase text-sm leading-tight text-slate-800">{b.name}</span>
                            <div className="flex items-center gap-2 mt-2">
                                <Badge variant="outline" className="text-[9px] font-black uppercase border-primary/30 text-primary">{b.commune}</Badge>
                                <span className="text-[9px] font-mono font-bold opacity-40 truncate">UID: {b.ownerId.substring(0, 12)}...</span>
                            </div>
                        </div>
                        <div className="flex gap-2 border-t pt-3">
                            <Button variant="outline" className="flex-1 h-12 font-black uppercase text-[10px] border-2" onClick={() => { setEditingBusiness(b); setName(b.name); setCommune(b.commune); setOwnerId(b.ownerId); setCategories(b.categories || []); setUserSearch(''); setIsDialogOpen(true); }}><Pencil className="size-4 mr-2" /> Modifier</Button>
                            <Button variant="ghost" className="h-12 px-4 text-destructive border-2 border-destructive/10" onClick={() => deleteDoc(doc(firestore!, 'businesses', b.id))}><Trash2 className="size-4" /></Button>
                        </div>
                    </div>
                ))}
            </CardContent>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-md w-[95vw] rounded-3xl overflow-hidden p-0 border-none shadow-2xl">
                    <DialogHeader className="p-6 bg-slate-50 border-b">
                        <DialogTitle className="font-black uppercase tracking-tighter flex items-center gap-2">
                            <LinkIcon className="size-5 text-primary" /> {editingBusiness ? "Modifier Boutique" : "Lier un compte PRO"}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="p-6 space-y-5">
                        {/* Recherche par email */}
                        <div className="space-y-1.5 relative">
                            <Label className="text-[10px] font-black uppercase ml-1 opacity-60">Recherche rapide (Email)</Label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                                <Input 
                                    placeholder="Chercher par email..." 
                                    value={userSearch} 
                                    onChange={e => {
                                        setUserSearch(e.target.value);
                                        setIsSearchOpen(e.target.value.length >= 2);
                                    }}
                                    className="h-12 pl-9 border-2 font-bold text-xs" 
                                />
                            </div>
                            
                            {isSearchOpen && filteredUsers.length > 0 && (
                                <div className="absolute z-50 w-full mt-1 bg-white border-2 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2">
                                    {filteredUsers.map(u => (
                                        <div 
                                            key={u.id} 
                                            className="p-3 hover:bg-primary/5 cursor-pointer border-b last:border-0 flex items-center justify-between"
                                            onClick={() => {
                                                setOwnerId(u.id);
                                                setName(u.displayName);
                                                setUserSearch(u.email);
                                                setIsSearchOpen(false);
                                                toast({ title: "Utilisateur sélectionné" });
                                            }}
                                        >
                                            <div className="flex flex-col min-w-0">
                                                <span className="font-black text-[10px] uppercase truncate">{u.displayName}</span>
                                                <span className="text-[9px] font-bold text-muted-foreground truncate">{u.email}</span>
                                            </div>
                                            <UserPlus className="size-4 text-primary shrink-0 ml-2" />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase ml-1">Nom du magasin</Label>
                            <Input value={name} onChange={e => setName(e.target.value)} className="h-14 border-2 font-black text-lg" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase ml-1">UID Utilisateur Pro</Label>
                            <Input value={ownerId} onChange={e => setOwnerId(e.target.value)} placeholder="UID sélectionné automatiquement..." className="h-14 border-2 font-mono text-xs bg-muted/30" readOnly={ownerId.length > 0} />
                            {ownerId && <Button variant="ghost" className="h-6 text-[8px] font-black uppercase text-destructive p-0" onClick={() => { setOwnerId(''); setUserSearch(''); }}>Effacer la liaison</Button>}
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase ml-1">Commune</Label>
                            <Select value={commune} onValueChange={setCommune}>
                                <SelectTrigger className="h-14 border-2 font-bold text-base"><SelectValue /></SelectTrigger>
                                <SelectContent className="max-h-64">{Object.keys(locations).sort().map(loc => <SelectItem key={loc} value={loc}>{loc}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase ml-1">Rayons autorisés</Label>
                            <div className="flex flex-wrap gap-2">
                                {availableCats.map(cat => (
                                    <Badge key={cat} variant={categories.includes(cat) ? "default" : "outline"} className="cursor-pointer font-black uppercase text-[10px] py-3 px-4 h-auto border-2 transition-all" onClick={() => setCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat])}>{cat}</Badge>
                                ))}
                            </div>
                        </div>
                    </div>
                    <DialogFooter className="p-4 bg-muted/10 border-t">
                        <Button onClick={handleSave} disabled={isSaving || !ownerId || !name} className="w-full h-16 font-black uppercase tracking-widest shadow-xl text-base">
                            {isSaving ? "Traitement..." : "Valider Liaison"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}

function FishGuideManager() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [search, setSearch] = useState('');
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [editingFish, setEditingFish] = useState<FishSpeciesInfo | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [name, setName] = useState('');
    const [scientificName, setScientificName] = useState('');
    const [category, setCategory] = useState<'Lagon' | 'Large' | 'Recif'>('Lagon');
    const [gratteRiskSmall, setGratteRiskSmall] = useState('0');
    const [gratteRiskMedium, setGratteRiskMedium] = useState('0');
    const [gratteRiskLarge, setGratteRiskLarge] = useState('0');
    const [lengthSmall, setLengthSmall] = useState('');
    const [lengthMedium, setLengthMedium] = useState('');
    const [lengthLarge, setLengthLarge] = useState('');
    const [fishingAdvice, setFishingAdvice] = useState('');
    const [culinaryAdvice, setCulinaryAdvice] = useState('');
    const [imageUrl, setImageUrl] = useState('');

    const fishRef = useMemoFirebase(() => firestore ? query(collection(firestore, 'fish_species'), orderBy('name', 'asc')) : null, [firestore]);
    const { data: species, isLoading } = useCollection<FishSpeciesInfo>(fishRef);

    const filtered = species?.filter(f => f.name.toLowerCase().includes(search.toLowerCase())) || [];

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            setImageUrl(event.target?.result as string);
            toast({ title: "Photo chargée" });
        };
        reader.readAsDataURL(file);
    };

    const handleSave = () => {
        if (!firestore || !name) return;
        setIsSaving(true);
        const data = { 
            name, 
            scientificName, 
            category, 
            gratteRiskSmall: parseInt(gratteRiskSmall), 
            gratteRiskMedium: parseInt(gratteRiskMedium), 
            gratteRiskLarge: parseInt(gratteRiskLarge), 
            lengthSmall,
            lengthMedium,
            lengthLarge,
            fishingAdvice, 
            culinaryAdvice, 
            imageUrl,
            updatedAt: serverTimestamp() 
        };
        const docRef = editingFish ? doc(firestore, 'fish_species', editingFish.id) : doc(collection(firestore, 'fish_species'));
        setDoc(docRef, data, { merge: true }).then(() => { 
            toast({ title: "Fiche sauvée" }); 
            setIsDialogOpen(false); 
            setIsSaving(false); 
        }).catch(() => setIsSaving(false));
    };

    return (
        <Card className="border-2 shadow-lg overflow-hidden rounded-2xl">
            <CardHeader className="p-5 bg-muted/5 border-b space-y-4">
                <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-lg font-black uppercase flex items-center gap-2 text-primary"><Fish className="size-5" /> Guide Poissons</CardTitle>
                            <CardDescription className="text-[10px] font-bold uppercase mt-1">Catalogue des espèces NC.</CardDescription>
                        </div>
                    </div>
                    <div className="relative"><Search className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" /><Input placeholder="Chercher un poisson..." value={search} onChange={e => setSearch(e.target.value)} className="pl-12 h-14 border-2 font-bold text-base" /></div>
                    <Button onClick={() => { 
                        setEditingFish(null); 
                        setName(''); 
                        setScientificName(''); 
                        setImageUrl('');
                        setCategory('Lagon');
                        setGratteRiskSmall('0');
                        setGratteRiskMedium('0');
                        setGratteRiskLarge('0');
                        setLengthSmall('');
                        setLengthMedium('');
                        setLengthLarge('');
                        setFishingAdvice('');
                        setCulinaryAdvice('');
                        setIsDialogOpen(true); 
                    }} className="w-full h-14 font-black uppercase tracking-widest shadow-md"><Plus className="size-5 mr-2" /> Nouvelle espèce</Button>
                </div>
            </CardHeader>
            <CardContent className="p-3 space-y-3">
                {isLoading ? <Skeleton className="h-32 w-full rounded-2xl" /> : filtered.map(f => {
                    const finalImageUrl = f.imageUrl || (f.imagePlaceholder ? `https://picsum.photos/seed/${f.imagePlaceholder}/400/400` : '');
                    return (
                        <div key={f.id} className="flex flex-col p-4 border-2 rounded-2xl bg-white shadow-sm gap-4">
                            <div className="flex items-center gap-4">
                                <div className="size-16 rounded-xl bg-muted/20 flex items-center justify-center shrink-0 overflow-hidden border shadow-sm">
                                    {finalImageUrl ? (
                                        <img src={finalImageUrl} alt={f.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <Fish className="size-6 text-primary/40" />
                                    )}
                                </div>
                                <div className="flex flex-col min-w-0 flex-1">
                                    <span className="font-black uppercase text-sm leading-tight text-slate-800 truncate">{f.name}</span>
                                    <div className="flex items-center gap-2 mt-1">
                                        <Badge variant="outline" className="text-[9px] font-black uppercase h-5 px-2 border-primary/20">{f.category}</Badge>
                                        <span className="text-[9px] italic font-bold opacity-40 truncate">{f.scientificName}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-2 border-t pt-3">
                                <Button variant="outline" className="flex-1 h-12 font-black uppercase text-[10px] border-2" onClick={() => { 
                                    setEditingFish(f); 
                                    setName(f.name); 
                                    setScientificName(f.scientificName); 
                                    setCategory(f.category); 
                                    setGratteRiskSmall(f.gratteRiskSmall?.toString() || '0'); 
                                    setGratteRiskMedium(f.gratteRiskMedium?.toString() || '0'); 
                                    setGratteRiskLarge(f.gratteRiskLarge?.toString() || '0'); 
                                    setLengthSmall(f.lengthSmall || '');
                                    setLengthMedium(f.lengthMedium || '');
                                    setLengthLarge(f.lengthLarge || '');
                                    setFishingAdvice(f.fishingAdvice || ''); 
                                    setCulinaryAdvice(f.culinaryAdvice || ''); 
                                    setImageUrl(f.imageUrl || '');
                                    setIsDialogOpen(true); 
                                }}><Pencil className="size-4 mr-2" /> Modifier</Button>
                                <Button variant="ghost" className="h-12 px-4 text-destructive border-2 border-destructive/10" onClick={() => deleteDoc(doc(firestore!, 'fish_species', f.id))}><Trash2 className="size-4" /></Button>
                            </div>
                        </div>
                    );
                })}
            </CardContent>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-2xl w-[95vw] rounded-3xl max-h-[90vh] overflow-y-auto p-0 border-none shadow-2xl">
                    <DialogHeader className="p-6 bg-slate-50 border-b"><DialogTitle className="font-black uppercase tracking-tighter text-xl">{editingFish ? "Modifier" : "Nouvelle Fiche"}</DialogTitle></DialogHeader>
                    <div className="p-6 py-4 space-y-6">
                        <div className="space-y-4">
                            <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase ml-1">Nom Local</Label><Input value={name} onChange={e => setName(e.target.value)} className="h-14 border-2 font-black text-lg" /></div>
                            
                            <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase ml-1">Nom Scientifique</Label><Input value={scientificName} onChange={e => setScientificName(e.target.value)} className="h-12 border-2 font-bold italic" /></div>

                            <div className="flex flex-col gap-3 p-4 bg-muted/10 rounded-2xl border-2 border-dashed">
                                <Label className="text-[10px] font-black uppercase ml-1 opacity-60">Photo de l'espèce</Label>
                                <div className="flex items-center gap-4">
                                    <div className="size-24 rounded-xl bg-white border-2 flex items-center justify-center overflow-hidden shrink-0">
                                        {imageUrl ? (
                                            <img src={imageUrl} className="w-full h-full object-cover" />
                                        ) : (
                                            <ImageIcon className="size-8 opacity-20" />
                                        )}
                                    </div>
                                    <div className="flex-1 space-y-2">
                                        <Button variant="outline" className="w-full h-12 border-2 font-black uppercase text-[10px] gap-2" onClick={() => fileInputRef.current?.click()}>
                                            <Camera className="size-4" /> Charger photo
                                        </Button>
                                        <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleFileChange} />
                                        {imageUrl && (
                                            <Button variant="ghost" className="w-full h-8 text-[9px] font-black uppercase text-destructive" onClick={() => setImageUrl('')}>
                                                <X className="size-3 mr-1" /> Supprimer
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <Button onClick={async () => { setIsGenerating(true); try { const info = await generateFishInfo({ name, scientificName }); setScientificName(info.scientificName); setCategory(info.category); setGratteRiskSmall(info.gratteRiskSmall.toString()); setGratteRiskMedium(info.gratteRiskMedium.toString()); setGratteRiskLarge(info.gratteRiskLarge.toString()); setLengthSmall(info.lengthSmall); setLengthMedium(info.lengthMedium); setLengthLarge(info.lengthLarge); setFishingAdvice(info.fishingAdvice); setCulinaryAdvice(info.culinaryAdvice); toast({ title: "Généré !" }); } finally { setIsGenerating(false); } }} disabled={isGenerating || !name} variant="secondary" className="w-full h-14 font-black uppercase text-xs gap-3 border-2 shadow-sm"><BrainCircuit className="size-5" /> Assistant IA (Générer fiche)</Button>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-2 p-5 bg-muted/20 rounded-2xl border-2 border-dashed">
                            <p className="col-span-3 text-[10px] font-black uppercase text-center opacity-50 tracking-widest mb-1">Risques de Gratte (%) : P / M / G</p>
                            <Input type="number" value={gratteRiskSmall} onChange={e => setGratteRiskSmall(e.target.value)} className="h-12 text-center font-black text-lg" />
                            <Input type="number" value={gratteRiskMedium} onChange={e => setGratteRiskMedium(e.target.value)} className="h-12 text-center font-black text-lg" />
                            <Input type="number" value={gratteRiskLarge} onChange={e => setGratteRiskLarge(e.target.value)} className="h-12 text-center font-black text-lg" />
                        </div>

                        <div className="grid grid-cols-3 gap-2 p-5 bg-muted/20 rounded-2xl border-2 border-dashed">
                            <p className="col-span-3 text-[10px] font-black uppercase text-center opacity-50 tracking-widest mb-1 flex items-center justify-center gap-2">
                                <Ruler className="size-3" /> Tailles Estimées (ex: &lt; 30cm) : P / M / G
                            </p>
                            <Input value={lengthSmall} onChange={e => setLengthSmall(e.target.value)} placeholder="Petit" className="h-12 text-center font-black text-sm" />
                            <Input value={lengthMedium} onChange={e => setLengthMedium(e.target.value)} placeholder="Moyen" className="h-12 text-center font-black text-sm" />
                            <Input value={lengthLarge} onChange={e => setLengthLarge(e.target.value)} placeholder="Grand" className="h-12 text-center font-black text-sm" />
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase ml-1">Conseils Pêche</Label><Textarea value={fishingAdvice} onChange={e => setFishingAdvice(e.target.value)} className="min-h-[100px] border-2 font-medium" /></div>
                            <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase ml-1">Conseils Cuisine</Label><Textarea value={culinaryAdvice} onChange={e => setCulinaryAdvice(e.target.value)} className="min-h-[100px] border-2 font-medium" /></div>
                        </div>
                    </div>
                    <DialogFooter className="p-4 border-t bg-muted/10"><Button onClick={handleSave} disabled={isSaving} className="w-full h-16 font-black uppercase tracking-widest shadow-xl text-base">Sauvegarder l'espèce</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}

function PermissionsManager({ users }: { users: UserAccount[] | null }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [search, setSearch] = useState('');
    const filtered = users?.filter(u => u.email.toLowerCase().includes(search.toLowerCase())).slice(0, 5) || [];

    return (
        <Card className="border-2 shadow-lg overflow-hidden rounded-2xl">
            <CardHeader className="p-5 bg-primary/5 border-b"><CardTitle className="text-lg font-black uppercase flex items-center gap-2 text-primary"><UserCog className="size-5" /> Permissions Master</CardTitle></CardHeader>
            <CardContent className="p-3 space-y-3">
                <div className="p-1"><Input placeholder="Chercher email..." value={search} onChange={e => setSearch(e.target.value)} className="h-14 border-2 font-bold text-base" /></div>
                {filtered.map(u => (
                    <div key={u.id} className="p-4 border-2 rounded-2xl bg-white flex flex-col gap-4 shadow-sm">
                        <div className="min-w-0">
                            <p className="font-black text-sm uppercase truncate text-slate-800">{u.displayName}</p>
                            <p className="text-[10px] font-bold text-muted-foreground truncate">{u.email}</p>
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label className="text-[9px] font-black uppercase opacity-40 ml-1">Changer le rôle</Label>
                            <Select defaultValue={u.role || 'client'} onValueChange={(val) => updateDoc(doc(firestore!, 'users', u.id), { role: val, subscriptionStatus: val === 'admin' ? 'admin' : (val === 'professional' ? 'professional' : 'trial') }).then(() => toast({ title: "Mis à jour" }))}>
                                <SelectTrigger className="w-full h-12 text-xs font-black uppercase border-2"><SelectValue /></SelectTrigger>
                                <SelectContent><SelectItem value="client" className="font-black uppercase text-xs">Client</SelectItem><SelectItem value="professional" className="font-black uppercase text-xs">Pro</SelectItem><SelectItem value="admin" className="font-black uppercase text-xs text-red-600">Admin</SelectItem></SelectContent>
                            </Select>
                        </div>
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}

function UsersManager({ users }: { users: UserAccount[] | null }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [search, setSearch] = useState('');
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const [userToDelete, setUserToDelete] = useState<UserAccount | null>(null);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    const [status, setStatus] = useState<UserAccount['subscriptionStatus']>('limited');
    const [expiry, setExpiry] = useState('');

    const filtered = users?.filter(u => u.email.toLowerCase().includes(search.toLowerCase()) || u.displayName.toLowerCase().includes(search.toLowerCase())).slice(0, 10) || [];

    const handleEditUser = (u: UserAccount) => {
        setEditingUser(u);
        setStatus(u.subscriptionStatus);
        setExpiry(u.subscriptionExpiryDate ? u.subscriptionExpiryDate.split('T')[0] : '');
        setIsEditDialogOpen(true);
    };

    const handleSaveUser = async () => {
        if (!firestore || !editingUser) return;
        setIsSaving(true);
        try {
            const updateData: any = {
                subscriptionStatus: status,
                subscriptionExpiryDate: expiry ? new Date(expiry).toISOString() : null
            };
            await updateDoc(doc(firestore, 'users', editingUser.id), updateData);
            toast({ title: "Compte mis à jour !" });
            setIsEditDialogOpen(false);
        } catch (e) {
            toast({ variant: 'destructive', title: "Erreur" });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteUser = async () => {
        if (!firestore || !userToDelete) return;
        try {
            await deleteDoc(doc(firestore, 'users', userToDelete.id));
            toast({ title: "Compte supprimé" });
            setIsDeleteDialogOpen(false);
            setUserToDelete(null);
        } catch (e) {
            toast({ variant: 'destructive', title: "Erreur suppression" });
        }
    };

    return (
        <Card className="border-2 shadow-sm overflow-hidden rounded-2xl">
            <CardHeader className="p-5 bg-muted/5 border-b"><CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2"><UsersIcon className="size-4" /> Liste des Comptes</CardTitle></CardHeader>
            <CardContent className="p-3 space-y-3">
                <div className="p-1"><Input placeholder="Chercher nom ou email..." value={search} onChange={e => setSearch(e.target.value)} className="h-12 border-2 text-sm" /></div>
                {filtered.map(u => (
                    <div key={u.id} className="p-4 border rounded-2xl flex items-center justify-between bg-card shadow-sm">
                        <div className="flex flex-col min-w-0 pr-2">
                            <span className="font-black uppercase text-xs truncate text-slate-800">{u.displayName}</span>
                            <span className="text-[10px] font-bold opacity-40 truncate">{u.email}</span>
                            {u.subscriptionExpiryDate && (u.subscriptionStatus === 'active' || u.subscriptionStatus === 'trial') && (
                                <span className="text-[8px] font-black uppercase text-primary mt-0.5">
                                    Expire le {format(new Date(u.subscriptionExpiryDate), 'dd/MM/yyyy')}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <Badge variant={u.subscriptionStatus === 'active' || u.subscriptionStatus === 'admin' ? 'default' : 'secondary'} className="text-[8px] font-black uppercase py-1 px-2">{u.subscriptionStatus}</Badge>
                            <Button variant="ghost" size="icon" className="size-10 border-2 rounded-xl" onClick={() => handleEditUser(u)}><Pencil className="size-4 opacity-60" /></Button>
                            <Button variant="ghost" size="icon" className="size-10 border-2 rounded-xl text-destructive/40 hover:text-destructive" onClick={() => { setUserToDelete(u); setIsDeleteDialogOpen(true); }}><Trash2 className="size-4" /></Button>
                            <button onClick={() => { navigator.clipboard.writeText(u.id); toast({ title: "ID Copié" }); }} className="p-3 bg-muted/20 hover:bg-muted rounded-xl transition-colors"><Copy className="size-4 opacity-40" /></button>
                        </div>
                    </div>
                ))}
            </CardContent>

            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="max-w-md rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="font-black uppercase tracking-tight">Gérer le compte</DialogTitle>
                        <DialogDescription className="text-xs font-bold uppercase truncate">{editingUser?.email}</DialogDescription>
                    </DialogHeader>
                    <div className="py-6 space-y-5">
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase opacity-60">Statut de l'abonnement</Label>
                            <Select value={status} onValueChange={(v: any) => setStatus(v)}>
                                <SelectTrigger className="h-14 border-2 font-black uppercase text-sm"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="active" className="font-black uppercase text-xs">ABONNÉ (ACTIVE)</SelectItem>
                                    <SelectItem value="trial" className="font-black uppercase text-xs">ESSAI (TRIAL)</SelectItem>
                                    <SelectItem value="professional" className="font-black uppercase text-xs">PRO (PARTENAIRE)</SelectItem>
                                    <SelectItem value="limited" className="font-black uppercase text-xs">LIMITÉ (EXPIRED)</SelectItem>
                                    <SelectItem value="admin" className="font-black uppercase text-xs text-red-600">ADMIN (MASTER)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase opacity-60">Date de fin d'activation</Label>
                            <div className="relative">
                                <Input type="date" value={expiry} onChange={e => setExpiry(e.target.value)} className="h-14 border-2 font-black text-lg pl-12" />
                                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={handleSaveUser} disabled={isSaving} className="w-full h-14 font-black uppercase tracking-widest shadow-xl">
                            {isSaving ? <RefreshCw className="size-5 animate-spin mr-2" /> : <Save className="size-5" />}
                            Appliquer les changements
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent className="rounded-3xl border-none shadow-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="font-black uppercase tracking-tight text-destructive flex items-center gap-2">
                            <AlertCircle className="size-5" /> Supprimer le compte ?
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-xs font-bold uppercase leading-relaxed">
                            Êtes-vous sûr de vouloir supprimer le profil de <span className="text-slate-900 font-black">{userToDelete?.email}</span> ? 
                            Cette action supprimera ses données Firestore mais pas son compte d'authentification Firebase.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2">
                        <AlertDialogCancel className="h-12 font-black uppercase text-[10px] border-2">Annuler</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteUser} className="h-12 font-black uppercase text-[10px] bg-destructive hover:bg-destructive/90">Supprimer définitivement</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Card>
    );
}

function GlobalAccessManager({ globalGift }: { globalGift: SharedAccessToken | null }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [duration, setDuration] = useState('1');
    const [isSaving, setIsSaving] = useState(false);

    const handleActivate = () => {
        if (!firestore) return; setIsSaving(true);
        const expiry = Timestamp.fromDate(addDays(new Date(), parseInt(duration)));
        setDoc(doc(firestore, 'shared_access_tokens', 'GLOBAL'), { expiresAt: expiry, updatedAt: serverTimestamp() }, { merge: true }).then(() => { toast({ title: "Offre activée !" }); setIsSaving(false); }).catch(() => setIsSaving(false));
    };

    const isGlobalActive = globalGift && globalGift.expiresAt && globalGift.expiresAt.toDate() > new Date();

    return (
        <Card className="border-2 shadow-lg rounded-2xl overflow-hidden">
            <CardHeader className="p-5 bg-primary/5 border-b"><CardTitle className="text-lg font-black uppercase flex items-center gap-2 text-primary"><Sparkles className="size-5" /> Accès Cadeau Global</CardTitle></CardHeader>
            <CardContent className="space-y-5 p-5">
                <div className={cn("p-5 rounded-2xl border-2 flex flex-col gap-3", isGlobalActive ? "bg-green-50 border-green-200" : "bg-muted/10 border-dashed")}>
                    <p className={cn("text-xs font-black uppercase tracking-widest text-center", isGlobalActive ? "text-green-600" : "text-muted-foreground")}>{isGlobalActive ? `ACTIF JUSQU'AU ${format(globalGift!.expiresAt.toDate(), 'dd/MM HH:mm')}` : 'OFFRE INACTIVE'}</p>
                    {isGlobalActive && <Button variant="destructive" className="w-full h-12 font-black uppercase text-xs shadow-md" onClick={() => updateDoc(doc(firestore!, 'shared_access_tokens', 'GLOBAL'), { expiresAt: Timestamp.fromDate(new Date(0)) })}>Désactiver l'accès libre</Button>}
                </div>
                <div className="space-y-4">
                    <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase ml-1 opacity-60">Durée de l'offre</Label>
                        <Select value={duration} onValueChange={setDuration}><SelectTrigger className="h-14 font-black text-lg"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1" className="font-black uppercase">1 jour</SelectItem><SelectItem value="7" className="font-black uppercase">1 semaine</SelectItem><SelectItem value="30" className="font-black uppercase">1 mois</SelectItem></SelectContent></Select>
                    </div>
                    <Button onClick={handleActivate} disabled={isSaving} className="w-full h-16 font-black uppercase shadow-xl text-base tracking-widest">Activer l'Accès Libre</Button>
                </div>
            </CardContent>
        </Card>
    );
}

function CampaignPricingManager() {
    const firestore = useFirestore();
    const { toast } = useToast();
    
    const pricingRef = useMemoFirebase(() => firestore ? doc(firestore, 'app_settings', 'campaign_pricing') : null, [firestore]);
    const { data: pricing } = useDoc<CampaignPricingSettings>(pricingRef);

    const [fixedPrice, setFixedPrice] = useState('0');
    const [unitPrice, setUnitPrice] = useState('0');
    const [priceSMS, setPriceSMS] = useState('0');
    const [pricePush, setPricePush] = useState('0');
    const [priceMail, setPriceMail] = useState('0');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (pricing) {
            setFixedPrice(pricing.fixedPrice.toString());
            setUnitPrice(pricing.unitPricePerUser.toString());
            setPriceSMS(pricing.priceSMS?.toString() || '0');
            setPricePush(pricing.pricePush?.toString() || '0');
            setPriceMail(pricing.priceMail?.toString() || '0');
        }
    }, [pricing]);

    const handleSave = async () => {
        if (!firestore) return;
        setIsSaving(true);
        try {
            await setDoc(doc(firestore, 'app_settings', 'campaign_pricing'), {
                fixedPrice: parseFloat(fixedPrice) || 0,
                unitPricePerUser: parseFloat(unitPrice) || 0,
                priceSMS: parseFloat(priceSMS) || 0,
                pricePush: parseFloat(pricePush) || 0,
                priceMail: parseFloat(priceMail) || 0,
                updatedAt: serverTimestamp()
            }, { merge: true });
            toast({ title: "Tarifs publicitaires mis à jour !" });
        } catch (e) {
            toast({ variant: 'destructive', title: "Erreur" });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Card className="border-2 shadow-lg rounded-2xl overflow-hidden">
            <CardHeader className="p-5 bg-muted/5 border-b">
                <CardTitle className="text-lg font-black uppercase flex items-center gap-2">
                    <DollarSign className="size-5 text-primary" /> Tarification Pub (Canaux)
                </CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase mt-1">Configurez les coûts des campagnes par canal de diffusion.</CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase ml-1 opacity-60">Prix Fixe de Lancement (F)</Label>
                        <Input type="number" value={fixedPrice} onChange={e => setFixedPrice(e.target.value)} className="h-14 border-2 font-black text-lg" />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase ml-1 opacity-60">Prix de Base par Utilisateur (F)</Label>
                        <Input type="number" value={unitPrice} onChange={e => setUnitPrice(e.target.value)} className="h-14 border-2 font-black text-lg" />
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-dashed pt-4">
                    <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-blue-600 ml-1 flex items-center gap-1"><Smartphone className="size-3"/> Tarif SMS (F)</Label>
                        <Input type="number" value={priceSMS} onChange={e => setPriceSMS(e.target.value)} className="h-14 border-2 border-blue-100 font-black text-lg" />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-primary ml-1 flex items-center gap-1"><Zap className="size-3"/> Tarif Push (F)</Label>
                        <Input type="number" value={pricePush} onChange={e => setPricePush(e.target.value)} className="h-14 border-2 border-primary/20 font-black text-lg" />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-green-600 ml-1 flex items-center gap-1"><Mail className="size-3"/> Tarif Email (F)</Label>
                        <Input type="number" value={priceMail} onChange={e => setPriceMail(e.target.value)} className="h-14 border-2 border-green-100 font-black text-lg" />
                    </div>
                </div>

                <Button onClick={handleSave} disabled={isSaving} className="w-full h-16 font-black uppercase shadow-xl text-base tracking-widest gap-3">
                    {isSaving ? <RefreshCw className="size-6 animate-spin" /> : <Save className="size-6" />} 
                    Sauver la tarification
                </Button>
            </CardContent>
        </Card>
    );
}

function TokenManager({ tokens, users }: { tokens: AccessToken[] | null, users: UserAccount[] | null }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [duration, setDuration] = useState('1');
    const [isGenerating, setIsGenerating] = useState(false);

    const generateToken = () => {
        if (!firestore) return; setIsGenerating(true);
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        const id = Array.from({ length: 10 }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
        setDoc(doc(firestore, 'access_tokens', id), { id, status: 'active', durationMonths: parseInt(duration), createdAt: serverTimestamp() }).then(() => { toast({ title: "Jeton généré !" }); setIsGenerating(false); }).catch(() => setIsGenerating(false));
    };

    return (
        <Card className="border-2 shadow-lg rounded-2xl overflow-hidden">
            <CardHeader className="p-5 bg-accent/5 border-b"><CardTitle className="text-lg font-black uppercase flex items-center gap-2 text-accent"><Ticket className="size-5" /> Jetons Premium</CardTitle></CardHeader>
            <CardContent className="space-y-6 p-5">
                <div className="flex flex-col gap-4 p-5 bg-accent/5 rounded-2xl border-2 border-accent/10">
                    <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase ml-1 opacity-60">Validité du jeton</Label>
                        <Select value={duration} onValueChange={setDuration}><SelectTrigger className="h-14 border-2 font-black text-lg bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1" className="font-black uppercase">1 mois</SelectItem><SelectItem value="3" className="font-black uppercase">3 mois</SelectItem><SelectItem value="12" className="font-black uppercase">12 mois</SelectItem></SelectContent></Select>
                    </div>
                    <Button onClick={generateToken} disabled={isGenerating} className="w-full h-16 bg-accent hover:bg-accent/90 text-white font-black uppercase tracking-widest shadow-xl text-base gap-3"><Zap className="size-5" /> Générer un Jeton</Button>
                </div>
                <div className="space-y-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Jetons actifs ({tokens?.length || 0})</p>
                    <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
                        {tokens?.slice(0, 20).map(t => {
                            const redeemedUser = t.redeemedBy ? users?.find(u => u.id === t.redeemedBy) : null;
                            return (
                                <div key={t.id} className={cn("p-4 flex items-center justify-between border-2 rounded-xl bg-white shadow-sm", t.status === 'redeemed' && "bg-slate-50 border-dashed opacity-80")}>
                                    <div className="flex flex-col min-w-0 pr-2">
                                        <div className="flex items-center gap-2">
                                            <code className="font-black text-primary text-xs select-all tracking-wider">{t.id}</code>
                                            {t.status === 'active' ? (
                                                <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200 text-[8px] font-black h-4 px-1.5 uppercase">Libre</Badge>
                                            ) : (
                                                <Badge variant="secondary" className="text-[8px] font-black h-4 px-1.5 uppercase">Utilisé</Badge>
                                            )}
                                        </div>
                                        <div className="flex flex-col mt-1 gap-0.5">
                                            <span className="text-[9px] font-bold uppercase opacity-40">{t.durationMonths} mois d'accès</span>
                                            {t.status === 'redeemed' && (
                                                <span className="text-[9px] font-black text-slate-600 truncate">
                                                    Par : {redeemedUser?.email || 'Utilisateur inconnu'}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <Button variant="ghost" size="icon" onClick={() => deleteDoc(doc(firestore!, 'access_tokens', t.id))} className="size-10 text-destructive/40 hover:text-destructive hover:bg-red-50 rounded-xl shrink-0"><Trash2 className="size-5" /></Button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function SystemNotificationsManager() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [type, setType] = useState<'info' | 'warning' | 'error' | 'success'>('info');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const notifsRef = useMemoFirebase(() => firestore ? query(collection(firestore, 'system_notifications'), orderBy('createdAt', 'desc')) : null, [firestore]);
    const { data: notifications } = useCollection<SystemNotification>(notifsRef);

    const handleSave = async () => {
        if (!firestore || !title || !content) return;
        setIsSaving(true);
        try {
            const data = { title, content, type, updatedAt: serverTimestamp() };
            if (editingId) {
                await updateDoc(doc(firestore, 'system_notifications', editingId), data);
                toast({ title: "Alerte mise à jour !" });
            } else {
                await addDoc(collection(firestore, 'system_notifications'), { ...data, isActive: true, createdAt: serverTimestamp() });
                toast({ title: "Alerte diffusée !" });
            }
            resetForm();
        } catch (e) {
            toast({ variant: 'destructive', title: "Erreur" });
        } finally {
            setIsSaving(false);
        }
    };

    const resetForm = () => {
        setTitle('');
        setContent('');
        setType('info');
        setEditingId(null);
    };

    const handleEdit = (n: SystemNotification) => {
        setTitle(n.title);
        setContent(n.content);
        setType(n.type);
        setEditingId(n.id);
        toast({ title: "Mode édition", description: "Modifiez l'alerte ci-dessus." });
    };

    const handleToggleActive = async (id: string, currentStatus: boolean) => {
        if (!firestore) return;
        await updateDoc(doc(firestore, 'system_notifications', id), { isActive: !currentStatus });
        toast({ title: !currentStatus ? "Alerte réactivée" : "Alerte mise en pause" });
    };

    return (
        <Card className="border-2 shadow-lg overflow-hidden rounded-2xl">
            <CardHeader className="p-5 bg-primary/5 border-b"><CardTitle className="text-lg font-black uppercase flex items-center gap-2 text-primary"><Bell className="size-5" /> Alertes Système</CardTitle></CardHeader>
            <CardContent className="p-4 space-y-6">
                <Alert className="bg-primary/5 border-dashed border-2">
                    <Info className="size-4 text-primary" />
                    <AlertDescription className="text-[10px] font-bold leading-relaxed">
                        Les alertes diffusées ici s'affichent instantanément en haut de la page d'accueil de tous les utilisateurs connectés.
                    </AlertDescription>
                </Alert>

                <div className={cn("grid gap-5 p-5 bg-muted/10 rounded-[2rem] border-2 border-dashed", editingId && "border-accent bg-accent/5")}>
                    <div className="space-y-4">
                        <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase ml-1 opacity-60">Titre de l'alerte</Label><Input value={title} onChange={e => setTitle(e.target.value)} className="h-14 border-2 font-black text-base uppercase" /></div>
                        <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase ml-1 opacity-60">Niveau / Couleur</Label><Select value={type} onValueChange={(v: any) => setType(v)}><SelectTrigger className="h-14 border-2 font-black text-sm uppercase bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="info" className="font-black uppercase text-xs text-blue-600">Information (Bleu)</SelectItem><SelectItem value="warning" className="font-black uppercase text-xs text-orange-600">Vigilance (Jaune)</SelectItem><SelectItem value="error" className="font-black uppercase text-xs text-red-600">Urgent (Rouge)</SelectItem><SelectItem value="success" className="font-black uppercase text-xs text-green-600">Succès (Vert)</SelectItem></SelectContent></Select></div>
                        <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase ml-1 opacity-60">Message</Label><Textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Détails du message..." className="border-2 min-h-[100px] font-medium text-sm" /></div>
                    </div>
                    <div className="flex gap-2">
                        {editingId && <Button variant="outline" onClick={resetForm} className="h-16 font-black uppercase border-2">Annuler</Button>}
                        <Button onClick={handleSave} disabled={isSaving || !title || !content} className="flex-1 h-16 font-black uppercase shadow-xl text-base tracking-widest gap-3">
                            {isSaving ? <RefreshCw className="size-6 animate-spin" /> : editingId ? <Save className="size-6" /> : <Plus className="size-6" />} 
                            {editingId ? "Mettre à jour" : "Diffuser l'alerte"}
                        </Button>
                    </div>
                </div>
                <div className="space-y-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Historique des diffusions ({notifications?.length || 0})</p>
                    <div className="flex flex-col gap-2">
                        {notifications?.map(n => (
                            <div key={n.id} className={cn("p-4 flex items-center justify-between border-2 rounded-2xl bg-white shadow-sm", !n.isActive && "opacity-60 border-dashed")}>
                                <div className="flex items-center gap-4 min-w-0 flex-1">
                                    <div className={cn("size-3 rounded-full shrink-0 shadow-sm", n.type === 'error' ? 'bg-red-500' : n.type === 'warning' ? 'bg-orange-500' : n.type === 'success' ? 'bg-green-500' : 'bg-blue-500')} />
                                    <div className="flex flex-col min-w-0">
                                        <span className="font-black uppercase text-xs truncate text-slate-800">{n.title}</span>
                                        {n.isActive ? (
                                            <span className="text-[8px] font-black text-green-600 uppercase flex items-center gap-1"><Zap className="size-2 fill-green-600"/> En ligne sur l'accueil</span>
                                        ) : (
                                            <span className="text-[8px] font-black text-muted-foreground uppercase">Hors-ligne (Stoppé)</span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-1">
                                    <Button variant="ghost" size="icon" className={cn("size-10 rounded-xl border", n.isActive ? "text-orange-600 border-orange-100" : "text-green-600 border-green-100")} onClick={() => handleToggleActive(n.id, n.isActive)} title={n.isActive ? "Pause" : "Démarrer"}>
                                        {n.isActive ? <XCircle className="size-5" /> : <PlayCircle className="size-5" />}
                                    </Button>
                                    <Button variant="ghost" size="icon" className="size-10 border border-slate-100 rounded-xl" onClick={() => handleEdit(n)} title="Modifier">
                                        <Pencil className="size-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="text-destructive/40 hover:text-destructive size-10 border border-red-50 rounded-xl" onClick={() => deleteDoc(doc(firestore!, 'system_notifications', n.id))}>
                                        <Trash2 className="size-5" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function AppSettingsManager() {
    const firestore = useFirestore();
    const { toast } = useToast();
    
    const splashRef = useMemoFirebase(() => firestore ? doc(firestore, 'app_settings', 'splash') : null, [firestore]);
    const { data: splash } = useDoc<SplashScreenSettings>(splashRef);
    const ribRef = useMemoFirebase(() => firestore ? doc(firestore, 'app_settings', 'rib') : null, [firestore]);
    const { data: rib } = useDoc<RibSettings>(ribRef);
    const cgvRef = useMemoFirebase(() => firestore ? doc(firestore, 'app_settings', 'cgv') : null, [firestore]);
    const { data: cgv } = useDoc<CgvSettings>(cgvRef);

    const [splashText, setSplashText] = useState('');
    const [splashBgColor, setSplashBgColor] = useState('#3b82f6');
    const [ribDetails, setRibDetails] = useState('');
    const [cgvContent, setCgvContent] = useState('');

    useEffect(() => { if (splash) { setSplashText(splash.splashText || ''); setSplashBgColor(splash.splashBgColor || '#3b82f6'); } }, [splash]);
    useEffect(() => { if (rib) setRibDetails(rib.details || ''); }, [rib]);
    useEffect(() => { if (cgv) setCgvContent(cgv.content || ''); }, [cgv]);

    return (
        <div className="flex flex-col gap-6">
            <Card className="border-2 shadow-lg rounded-2xl overflow-hidden">
                <CardHeader className="p-5 bg-muted/5 border-b"><CardTitle className="text-lg font-black uppercase flex items-center gap-2"><Smartphone className="size-5 text-primary" /> Splash Screen</CardTitle></CardHeader>
                <CardContent className="p-5 space-y-5">
                    <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase ml-1 opacity-60">Texte d'accueil</Label><Input value={splashText} onChange={e => setSplashText(e.target.value)} className="h-14 border-2 font-black text-lg" /></div>
                    <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase ml-1 opacity-60">Couleur de fond</Label>
                        <div className="flex gap-2"><Input type="color" value={splashBgColor} onChange={e => setSplashBgColor(e.target.value)} className="h-14 w-20 border-2 p-1 rounded-xl" /><Input value={splashBgColor} readOnly className="font-mono font-bold text-center h-14 border-2 flex-1" /></div>
                    </div>
                    <Button onClick={() => updateDoc(doc(firestore!, 'app_settings', 'splash'), { splashText, splashBgColor }).then(() => toast({ title: "Splash mis à jour" }))} className="w-full h-16 font-black uppercase shadow-xl text-base tracking-widest gap-3"><Save className="size-6" /> Sauver Design</Button>
                </CardContent>
            </Card>

            <Card className="border-2 shadow-lg rounded-2xl overflow-hidden">
                <CardHeader className="p-5 bg-muted/5 border-b"><CardTitle className="text-lg font-black uppercase flex items-center gap-2"><Landmark className="size-5 text-primary" /> Coordonnées RIB</CardTitle></CardHeader>
                <CardContent className="p-5 space-y-5">
                    <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase ml-1 opacity-60">Détails bancaires (DONS)</Label><Textarea value={ribDetails} onChange={e => setRibDetails(e.target.value)} className="min-h-[120px] border-2 font-mono text-sm leading-tight" /></div>
                    <Button onClick={() => setDoc(doc(firestore!, 'app_settings', 'rib'), { details: ribDetails, updatedAt: serverTimestamp() }, { merge: true }).then(() => toast({ title: "RIB mis à jour" }))} className="w-full h-16 font-black uppercase shadow-xl text-base tracking-widest gap-3"><Save className="size-6" /> Sauver RIB</Button>
                </CardContent>
            </Card>
            <Card className="border-2 shadow-lg rounded-2xl overflow-hidden">
                <CardHeader className="p-5 bg-muted/5 border-b"><CardTitle className="text-lg font-black uppercase flex items-center gap-2"><ScrollText className="size-5 text-primary" /> Conditions (CGV)</CardTitle></CardHeader>
                <CardContent className="p-5 space-y-5">
                    <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase ml-1 opacity-60">Contenu des conditions</Label><Textarea value={cgvContent} onChange={e => setCgvContent(e.target.value)} className="min-h-[250px] border-2 text-xs leading-relaxed font-medium" /></div>
                    <div className="p-4 bg-muted/30 rounded-xl border-2 border-dashed flex justify-between items-center"><span className="text-[10px] font-black uppercase opacity-60">Version actuelle :</span><Badge variant="default" className="font-black text-xs h-7 px-3">{cgv?.version || 0}</Badge></div>
                    <Button onClick={() => setDoc(doc(firestore!, 'app_settings', 'cgv'), { content: cgvContent, version: (cgv?.version || 0) + 1, updatedAt: serverTimestamp() }, { merge: true }).then(() => toast({ title: "CGV Version " + ((cgv?.version || 0) + 1) }))} className="w-full h-16 font-black uppercase shadow-xl text-base tracking-widest gap-3"><RefreshCw className="size-6" /> Mettre à jour (Nouvelle Version)</Button>
                </CardContent>
            </Card>
        </div>
    );
}

function SupportManager({ 
    conversations, 
    isLoadingConvs,
    tickets,
    isLoadingTickets
}: { 
    conversations: Conversation[] | null, 
    isLoadingConvs: boolean,
    tickets: SupportTicket[] | null,
    isLoadingTickets: boolean
}) {
    const [subTab, setSubTab] = useState<'chats' | 'tickets'>('chats');

    return (
        <Card className="border-2 shadow-lg rounded-2xl overflow-hidden">
            <CardHeader className="p-5 bg-green-50 border-b flex flex-col gap-4">
                <div className="flex items-center gap-2 text-green-800">
                    <MessageSquare className="size-5" /> 
                    <CardTitle className="text-lg font-black uppercase">Support & Tickets</CardTitle>
                </div>
                <Tabs value={subTab} onValueChange={(v: any) => setSubTab(v)} className="w-full">
                    <TabsList className="grid grid-cols-2 h-10 border-2 bg-white/50">
                        <TabsTrigger value="chats" className="font-black uppercase text-[10px]">Direct Chats</TabsTrigger>
                        <TabsTrigger value="tickets" className="font-black uppercase text-[10px]">Tickets Aide</TabsTrigger>
                    </TabsList>
                </Tabs>
            </CardHeader>
            <CardContent className="p-3 space-y-3">
                {subTab === 'chats' ? (
                    <>
                        {isLoadingConvs ? (
                            <div className="space-y-3"><Skeleton className="h-24 w-full rounded-2xl"/><Skeleton className="h-24 w-full rounded-2xl"/></div>
                        ) : conversations && conversations.length > 0 ? conversations.map(c => (
                            <Link key={c.id} href={`/admin/messages/${c.id}`} className={cn("flex flex-col p-5 border-2 rounded-3xl bg-white shadow-sm transition-all active:scale-[0.98]", !c.isReadByAdmin && "border-primary bg-primary/5 ring-2 ring-primary/10")}>
                                <div className="flex justify-between items-start mb-3">
                                    <div className="min-w-0 flex-1">
                                        <p className="font-black text-sm uppercase truncate text-slate-800">{c.userDisplayName}</p>
                                        <p className="text-[10px] font-bold opacity-40 leading-none mt-1">{c.userEmail}</p>
                                    </div>
                                    {!c.isReadByAdmin && <Badge className="bg-primary animate-pulse text-[9px] h-5 px-2 font-black uppercase tracking-wider">Nouveau</Badge>}
                                </div>
                                <div className="bg-muted/10 p-3 rounded-2xl border-2 border-dashed border-muted-foreground/10">
                                    <p className="text-xs text-muted-foreground italic line-clamp-2 leading-relaxed font-medium">"{c.lastMessageContent}"</p>
                                </div>
                                <div className="mt-4 pt-4 border-t border-dashed flex justify-between items-center">
                                    <span className="text-[10px] font-black opacity-30 uppercase tracking-widest">{c.lastMessageAt ? format(c.lastMessageAt.toDate(), 'dd/MM HH:mm') : '...'}</span>
                                    <div className="flex items-center gap-2 font-black uppercase text-[10px] text-primary">Répondre <ChevronRight className="size-4" /></div>
                                </div>
                            </Link>
                        )) : <div className="p-20 text-center text-muted-foreground font-black uppercase opacity-30 italic text-sm tracking-[0.2em]">Aucun message actif.</div>}
                    </>
                ) : (
                    <>
                        {isLoadingTickets ? (
                            <div className="space-y-3"><Skeleton className="h-24 w-full rounded-2xl"/><Skeleton className="h-24 w-full rounded-2xl"/></div>
                        ) : tickets && tickets.length > 0 ? tickets.map(t => (
                            <TicketAdminCard key={t.id} ticket={t} />
                        )) : <div className="p-20 text-center text-muted-foreground font-black uppercase opacity-30 italic text-sm tracking-[0.2em]">Aucun ticket actif.</div>}
                    </>
                )}
            </CardContent>
        </Card>
    );
}

function TicketAdminCard({ ticket }: { ticket: SupportTicket }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [response, setResponse] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);

    const handleReply = async () => {
        if (!firestore || !response.trim()) return;
        setIsSaving(true);
        try {
            await updateDoc(doc(firestore, 'cms_support', 'tickets', 'items', ticket.id), {
                adminResponse: response.trim(),
                statut: 'ferme',
                respondedAt: serverTimestamp()
            });
            toast({ title: "Ticket clôturé avec réponse" });
            setIsExpanded(false);
        } catch (e) {
            toast({ variant: 'destructive', title: "Erreur" });
        } finally {
            setIsSaving(false);
        }
    };

    const handleCloseOnly = async () => {
        if (!firestore) return;
        setIsSaving(true);
        try {
            await updateDoc(doc(firestore, 'cms_support', 'tickets', 'items', ticket.id), {
                statut: 'ferme',
                respondedAt: serverTimestamp()
            });
            toast({ title: "Ticket clôturé (archivé)" });
            setIsExpanded(false);
        } catch (e) {
            toast({ variant: 'destructive', title: "Erreur" });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Card className={cn("overflow-hidden border-2 transition-all", ticket.statut === 'ouvert' ? "border-orange-200 bg-orange-50/10" : "bg-white opacity-70")}>
            <CardHeader className="p-4 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
                <div className="flex justify-between items-start mb-2">
                    <Badge variant={ticket.statut === 'ouvert' ? 'default' : 'secondary'} className="text-[8px] font-black uppercase h-4">
                        {ticket.statut}
                    </Badge>
                    <span className="text-[9px] font-bold opacity-40">{ticket.createdAt ? format(ticket.createdAt.toDate(), 'dd/MM HH:mm') : '...'}</span>
                </div>
                <CardTitle className="text-xs font-black uppercase text-slate-800">{ticket.sujet}</CardTitle>
                <CardDescription className="text-[10px] font-bold truncate">{ticket.userEmail}</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-4">
                <div className="p-3 bg-white border-2 rounded-xl text-xs leading-relaxed font-medium italic text-muted-foreground">
                    "{ticket.description}"
                </div>

                {isExpanded && (
                    <div className="space-y-3 animate-in slide-in-from-top-2 pt-2 border-t border-dashed">
                        <Label className="text-[9px] font-black uppercase text-primary">Votre réponse d'expert</Label>
                        <Textarea 
                            value={response} 
                            onChange={e => setResponse(e.target.value)} 
                            placeholder="Saisissez la réponse..." 
                            className="min-h-[100px] border-2 text-xs font-medium"
                        />
                        <div className="flex gap-2">
                            <Button 
                                variant="outline"
                                className="flex-1 h-12 font-black uppercase text-[10px] border-2 text-destructive border-destructive/20" 
                                onClick={handleCloseOnly} 
                                disabled={isSaving}
                            >
                                <XCircle className="size-4 mr-2" /> Clôturer
                            </Button>
                            <Button 
                                className="flex-[2] h-12 font-black uppercase tracking-widest gap-2 shadow-lg" 
                                onClick={handleReply} 
                                disabled={isSaving || !response.trim()}
                            >
                                {isSaving ? <RefreshCw className="size-4 animate-spin" /> : <Send className="size-4" />}
                                Répondre & Fermer
                            </Button>
                        </div>
                    </div>
                )}

                {ticket.adminResponse && !isExpanded && (
                    <div className="p-3 bg-green-50 border-2 border-green-100 rounded-xl space-y-1">
                        <p className="text-[9px] font-black uppercase text-green-700 flex items-center gap-1">
                            <CheckCircle2 className="size-3" /> Réponse envoyée
                        </p>
                        <p className="text-[10px] font-bold italic line-clamp-2">"{ticket.adminResponse}"</p>
                    </div>
                )}

                {!isExpanded && (
                    <Button variant="ghost" className="w-full h-8 text-[9px] font-black uppercase text-primary gap-2" onClick={() => setIsExpanded(true)}>
                        {ticket.adminResponse ? "Modifier la réponse" : "Ouvrir pour répondre"} <ChevronRight className="size-3" />
                    </Button>
                )}
            </CardContent>
        </Card>
    );
}
