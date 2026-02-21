'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useMapCore } from '@/logic/shared/useMapCore';
import { useEmetteur } from '@/logic/emetteur/useEmetteur';
import { useRecepteur } from '@/logic/recepteur/useRecepteur';
import { useFlotte } from '@/logic/flotteC/useFlotte';
import { GoogleMap, OverlayView, Polyline, Circle } from '@react-google-maps/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Navigation, 
  Anchor, 
  LocateFixed, 
  ShieldAlert, 
  Expand, 
  Shrink, 
  Zap, 
  AlertTriangle,
  BatteryFull, 
  History as HistoryIcon, 
  MapPin, 
  X, 
  Play, 
  RefreshCw, 
  Home, 
  Settings, 
  Smartphone, 
  Bird, 
  Target, 
  Fish, 
  Camera, 
  Ghost, 
  Users, 
  Phone, 
  Waves, 
  Lock, 
  Unlock, 
  Save, 
  Battery,
  MessageSquare,
  CheckCircle2,
  Trash2,
  ChevronDown,
  ChevronRight,
  Volume2,
  Timer,
  Bell,
  Eye,
  EyeOff,
  ClipboardList
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

const INITIAL_CENTER = { lat: -21.3, lng: 165.5 };

const TACTICAL_SPECIES = [
    { label: 'MARLIN', icon: Target },
    { label: 'THON', icon: Fish },
    { label: 'TAZARD', icon: Fish },
    { label: 'WAHOO', icon: Fish },
    { label: 'BONITE', icon: Fish },
    { label: 'SARDINES', icon: Waves },
    { label: 'OISEAUX', icon: Bird }
];

const TACTICAL_ICONS: Record<string, any> = {
    'MARLIN': Target,
    'THON': Fish,
    'TAZARD': Fish,
    'WAHOO': Fish,
    'BONITE': Fish,
    'SARDINES': Waves,
    'OISEAUX': Bird,
    'PHOTO': Camera
};

export default function VesselTrackerPage() {
  const [appMode, setAppMode] = useState<'sender' | 'receiver' | 'fleet'>('sender');
  const [vesselIdToFollow, setVesselIdToFollow] = useState('');
  const { toast } = useToast();
  
  const mapCore = useMapCore();
  const emetteur = useEmetteur(
    (lat, lng) => {
        mapCore.updateBreadcrumbs(lat, lng);
        if (mapCore.isFollowMode && mapCore.googleMap) {
            mapCore.googleMap.panTo({ lat, lng });
        }
    },
    () => {
        mapCore.clearBreadcrumbs();
        if (mapCore.googleMap) {
            // Cleanup markers manually if needed
        }
    }
  );
  
  const recepteur = useRecepteur(emetteur.sharingId);
  const flotte = useFlotte(emetteur.sharingId, emetteur.vesselNickname);
  
  const photoInputRef = useRef<HTMLInputElement>(null);
  const hasCenteredInitially = useRef(false);

  useEffect(() => {
    if (emetteur.currentPos && !hasCenteredInitially.current && mapCore.googleMap) {
        mapCore.handleRecenter(emetteur.currentPos);
        hasCenteredInitially.current = true;
    }
  }, [emetteur.currentPos, mapCore.googleMap]);

  useEffect(() => {
    const ids = [];
    if (emetteur.isSharing) ids.push(emetteur.sharingId);
    const unsub = mapCore.syncTacticalMarkers(ids);
    return () => unsub();
  }, [emetteur.isSharing, emetteur.sharingId, mapCore]);

  const [isLedActive, setIsLedActive] = useState(false);
  useEffect(() => {
    if (emetteur.lastSyncTime > 0) {
      setIsLedActive(true);
      const timer = setTimeout(() => setIsLedActive(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [emetteur.lastSyncTime]);

  const handleRecenter = () => {
    if (emetteur.currentPos) {
        mapCore.handleRecenter(emetteur.currentPos);
    } else {
        toast({ description: "En attente de signal GPS..." });
    }
  };

  return (
    <div className="w-full space-y-4 pb-32 px-1 relative">
      {recepteur.isAlarmActive && (
        <Button 
            className="fixed top-2 left-1/2 -translate-x-1/2 z-[10000] h-14 bg-red-600 hover:bg-red-700 text-white font-black uppercase shadow-2xl animate-bounce gap-3 px-8 rounded-full border-4 border-white"
            onClick={recepteur.stopAllAlarms}
        >
            <Volume2 className="size-6 animate-pulse" /> ARRÊTER LE SON
        </Button>
      )}

      <div className="flex bg-slate-900 text-white p-1 rounded-xl shadow-lg border-2 border-primary/20 sticky top-0 z-[100]">
          <Button variant={appMode === 'sender' ? 'default' : 'ghost'} className="flex-1 font-black uppercase text-[10px] h-12" onClick={() => { setAppMode('sender'); recepteur.initAudio(); }}>Émetteur (A)</Button>
          <Button variant={appMode === 'receiver' ? 'default' : 'ghost'} className="flex-1 font-black uppercase text-[10px] h-12" onClick={() => { setAppMode('receiver'); recepteur.initAudio(); }}>Récepteur (B)</Button>
          <Button variant={appMode === 'fleet' ? 'default' : 'ghost'} className="flex-1 font-black uppercase text-[10px] h-12" onClick={() => { setAppMode('fleet'); recepteur.initAudio(); }}>Flotte (C)</Button>
      </div>

      {!recepteur.audioAuthorized && (
        <Alert className="bg-primary/10 border-primary/20 border-2">
            <Zap className="size-4 text-primary" />
            <AlertTitle className="text-xs font-black uppercase">Initialisation Audio</AlertTitle>
            <AlertDescription className="text-[10px] font-bold">
                Appuyez n'importe où sur l'écran pour activer les alertes sonores de sécurité.
            </AlertDescription>
        </Alert>
      )}

      <div className={cn("relative w-full rounded-[2.5rem] border-4 border-slate-900 shadow-2xl overflow-hidden bg-slate-100 transition-all", mapCore.isFullscreen ? "fixed inset-0 z-[150] h-screen" : "h-[500px]")}>
        {mapCore.isGoogleLoaded ? (
            <GoogleMap
                mapContainerClassName="w-full h-full"
                defaultCenter={INITIAL_CENTER}
                defaultZoom={12}
                onLoad={mapCore.setGoogleMap}
                onDragStart={() => mapCore.setIsFollowMode(false)}
                options={{ 
                    disableDefaultUI: true, 
                    mapTypeId: mapCore.viewMode === 'alpha' ? 'hybrid' : 'roadmap', 
                    gestureHandling: 'greedy' 
                }}
            >
                {emetteur.currentPos && (
                    <OverlayView position={emetteur.currentPos} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                        <div style={{ transform: 'translate(-50%, -50%)' }} className="relative z-[1000]">
                            <div className="size-10 bg-blue-500/20 rounded-full animate-ping absolute inset-0" />
                            <div className="size-6 bg-blue-500 border-4 border-white rounded-full shadow-lg flex items-center justify-center">
                                <Navigation className="size-3 text-white fill-white" />
                            </div>
                        </div>
                    </OverlayView>
                )}

                {mapCore.breadcrumbs.length > 1 && (
                    <Polyline 
                        path={mapCore.breadcrumbs} 
                        options={{ strokeColor: "#3b82f6", strokeOpacity: 0.6, strokeWeight: 2 }} 
                    />
                )}

                {!mapCore.isTacticalHidden && mapCore.tacticalMarkers.map(marker => {
                    const Icon = TACTICAL_ICONS[marker.type] || Fish;
                    return (
                        <OverlayView key={marker.id} position={marker.pos} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                            <div style={{ transform: 'translate(-50%, -100%)' }} className="flex flex-col items-center group cursor-pointer z-[500]" onClick={() => mapCore.handleRecenter(marker.pos)}>
                                <div className="px-2 py-1 bg-white/90 backdrop-blur-md rounded border shadow-lg text-[8px] font-black uppercase opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap mb-1">
                                    {marker.type} - {marker.vesselName} • {format(marker.time, 'HH:mm')}
                                    {marker.weather && <div className="text-primary mt-0.5">{marker.weather.windSpeed} ND • {marker.weather.temp}°C</div>}
                                </div>
                                <div className="p-1.5 bg-accent rounded-full border-2 border-white shadow-xl">
                                    <Icon className="size-3.5 text-white" />
                                </div>
                            </div>
                        </OverlayView>
                    );
                })}

                {emetteur.anchorPos && (
                    <>
                        <OverlayView position={emetteur.anchorPos} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                            <div style={{ transform: 'translate(-50%, -50%)' }} className="size-8 bg-orange-500 rounded-full border-2 border-white flex items-center justify-center shadow-lg z-[800]">
                                <Anchor className="size-4 text-white" />
                            </div>
                        </OverlayView>
                        <Circle 
                            center={emetteur.anchorPos} 
                            radius={emetteur.mooringRadius} 
                            options={{ strokeColor: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.15, strokeWeight: 1 }} 
                        />
                    </>
                )}
            </GoogleMap>
        ) : <Skeleton className="h-full w-full" />}
        
        <div className="absolute top-4 left-4 z-[9999] flex flex-col gap-2">
            <Button size="icon" className="bg-white/90 border-2 h-10 w-10 text-primary shadow-xl rounded-xl hover:bg-white" onClick={() => mapCore.setIsFullscreen(!mapCore.isFullscreen)}>
                {mapCore.isFullscreen ? <Shrink className="size-5" /> : <Expand className="size-5" />}
            </Button>
        </div>
        <div className="absolute top-4 right-4 z-[9999] flex flex-col gap-2">
            <Button onClick={() => mapCore.setIsFollowMode(!mapCore.isFollowMode)} className={cn("h-10 w-10 border-2 shadow-xl rounded-xl transition-all", mapCore.isFollowMode ? "bg-primary text-white" : "bg-white text-primary")}>
                {mapCore.isFollowMode ? <Lock className="size-5" /> : <Unlock className="size-5" />}
            </Button>
            <Button onClick={handleRecenter} className="bg-white/90 border-2 h-10 w-10 text-primary shadow-xl rounded-xl hover:bg-white flex items-center justify-center">
                <LocateFixed className="size-5"/>
            </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
          {appMode === 'sender' && (
              <Card className="border-2 shadow-lg rounded-3xl overflow-hidden border-primary/20">
                  <CardHeader className="bg-primary/5 p-5 border-b flex flex-row justify-between items-center">
                      <div>
                        <CardTitle className="text-sm font-black uppercase flex items-center gap-2 text-primary">
                            <Navigation className="size-4 text-primary" /> Identité &amp; IDs
                        </CardTitle>
                        <CardDescription className="text-[9px] font-bold uppercase mt-0.5">Partage vers Récepteur et Flotte</CardDescription>
                      </div>
                      {emetteur.isSharing && (
                        <div className="flex items-center gap-2">
                            <div className={cn("size-3 rounded-full bg-green-500 shadow-sm transition-all", isLedActive ? "scale-125 glow" : "opacity-30")} />
                            <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200 font-black text-[8px] uppercase h-5">LIVE</Badge>
                        </div>
                      )}
                  </CardHeader>
                  <CardContent className="p-5 space-y-5">
                      {!emetteur.isSharing ? (
                          <div className="space-y-5">
                              <div className="space-y-1.5">
                                  <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Mon Surnom</Label>
                                  <Input value={emetteur.vesselNickname} onChange={e => emetteur.setVesselNickname(e.target.value)} placeholder="EX: KOOLAPIK" className="h-12 border-2 font-black text-lg shadow-inner" />
                              </div>
                              
                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-black uppercase opacity-60 ml-1">ID Navire</Label>
                                    <Input value={emetteur.customSharingId} onChange={e => emetteur.setCustomSharingId(e.target.value)} placeholder="ABC-123" className="h-12 border-2 font-black text-center uppercase tracking-widest bg-slate-50" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-black uppercase opacity-60 ml-1 text-indigo-600">ID Flotte C</Label>
                                    <Input value={emetteur.customFleetId} onChange={e => emetteur.setCustomFleetId(e.target.value)} placeholder="GROUPE" className="h-12 border-2 border-indigo-100 font-black text-center uppercase tracking-widest bg-indigo-50/30" />
                                </div>
                              </div>

                              {emetteur.idsHistory.length > 0 && (
                                <div className="space-y-2">
                                    <p className="text-[9px] font-black uppercase text-slate-400 flex items-center gap-2 ml-1">
                                        <HistoryIcon className="size-3" /> Historique des IDs
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {emetteur.idsHistory.map((h, i) => (
                                            <div key={i} className="flex items-center bg-white border-2 rounded-xl overflow-hidden shadow-sm">
                                                <button 
                                                    onClick={() => emetteur.loadFromHistory(h.vId, h.fId)}
                                                    className="px-3 py-2 text-[9px] font-black uppercase hover:bg-primary/5 transition-colors border-r"
                                                >
                                                    {h.vId} {h.fId && <span className="text-indigo-600">| {h.fId}</span>}
                                                </button>
                                                <button 
                                                    onClick={() => emetteur.removeFromHistory(h.vId)}
                                                    className="px-2 py-2 text-destructive/40 hover:text-destructive hover:bg-red-50 transition-colors"
                                                >
                                                    <X className="size-3" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                              )}

                              <Button className="w-full h-16 font-black uppercase text-base bg-primary rounded-2xl shadow-xl gap-3 group transition-all active:scale-95" onClick={emetteur.startSharing}>
                                  <Zap className="size-5 fill-white group-hover:animate-pulse" /> Lancer le Partage GPS
                              </Button>
                          </div>
                      ) : (
                          <div className="space-y-4">
                              <div className="p-5 bg-primary/5 rounded-2xl border-2 border-primary/20 text-center relative overflow-hidden">
                                  <Navigation className="absolute -right-2 -bottom-2 size-12 opacity-5 rotate-12" />
                                  <p className="text-[10px] font-black uppercase text-primary tracking-[0.2em] mb-1">Identité Active</p>
                                  <h4 className="text-2xl font-black uppercase tracking-tighter text-slate-800">{emetteur.sharingId}</h4>
                                  <p className="text-[9px] font-bold text-muted-foreground uppercase mt-1 italic">
                                    Capitaine : {emetteur.vesselNickname || 'Inconnu'} • {emetteur.customFleetId ? `Flotte: ${emetteur.customFleetId.toUpperCase()}` : 'Pas de groupe'}
                                  </p>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                  <Button variant="outline" className="h-14 font-black uppercase text-[10px] border-2 bg-background gap-2" onClick={() => emetteur.triggerEmergency('ASSISTANCE')}>
                                      <RefreshCw className="size-4 text-primary" /> Assistance
                                  </Button>
                                  <Button 
                                    variant="outline" 
                                    className={cn("h-14 font-black uppercase text-[10px] border-2 bg-background gap-2", emetteur.vesselStatus === 'stationary' && "bg-orange-500 text-white border-orange-600 shadow-inner")} 
                                    onClick={() => { if (emetteur.anchorPos) emetteur.setAnchorPos(null); else emetteur.setAnchorPos(emetteur.currentPos); }}
                                  >
                                      <Anchor className={cn("size-4", emetteur.vesselStatus === 'stationary' ? "text-white" : "text-orange-600")} /> Mouillage
                                  </Button>
                              </div>
                              <Button variant="destructive" className="w-full h-16 font-black uppercase rounded-2xl border-2 shadow-lg gap-3 transition-all active:scale-95" onClick={emetteur.stopSharing}>
                                  <X className="size-5" /> Arrêter le partage
                              </Button>
                          </div>
                      )}
                  </CardContent>
              </Card>
          )}

          {appMode === 'receiver' && (
              <Card className="border-2 shadow-lg rounded-3xl overflow-hidden border-blue-200">
                  <CardHeader className="bg-blue-50 p-5 border-b flex flex-row justify-between items-center">
                      <div>
                        <CardTitle className="text-sm font-black uppercase flex items-center gap-2 text-blue-800">
                            <Smartphone className="size-4" /> Suivi Récepteur
                        </CardTitle>
                        <CardDescription className="text-[9px] font-bold uppercase mt-0.5">Surveillance à terre</CardDescription>
                      </div>
                  </CardHeader>
                  <CardContent className="p-5 space-y-4">
                      <div className="space-y-1.5">
                          <Label className="text-[10px] font-black uppercase opacity-60 ml-1">ID du Navire à suivre</Label>
                          <div className="flex gap-2">
                              <Input 
                                placeholder="ENTREZ L'ID..." 
                                value={vesselIdToFollow} 
                                onChange={e => setVesselIdToFollow(e.target.value)} 
                                className="font-black text-center h-12 border-2 uppercase tracking-widest bg-white flex-grow" 
                              />
                              <Button variant="default" className="h-12 px-4 font-black uppercase text-[10px] shrink-0" onClick={() => { recepteur.savePrefs({ lastFollowedId: vesselIdToFollow.toUpperCase() }); toast({ title: "ID enregistré" }); }}>
                                  <Check className="size-4" />
                              </Button>
                          </div>
                      </div>
                  </CardContent>
              </Card>
          )}
      </div>

      <div id="cockpit-logs" className="fixed bottom-16 left-0 right-0 z-[10001] px-1 pointer-events-none">
          <div className="max-w-2xl mx-auto pointer-events-auto">
              {emetteur.isSharing && (
                  <div className="flex gap-2 mb-2 p-2 bg-slate-900/10 backdrop-blur-md rounded-2xl border-2 border-white/20 z-[10002] relative">
                      <Button 
                        variant={emetteur.vesselStatus === 'emergency' ? 'default' : 'destructive'} 
                        className={cn("flex-1 h-16 font-black uppercase text-xs shadow-2xl border-2 transition-all active:scale-95", 
                            emetteur.vesselStatus === 'emergency' ? "bg-red-600 animate-pulse border-white" : "bg-red-700 border-red-400")}
                        onClick={() => emetteur.triggerEmergency('MAYDAY')}
                      >
                          <ShieldAlert className="size-6 mr-2" /> MAYDAY
                      </Button>
                      <Button 
                        variant="secondary" 
                        className={cn("flex-1 h-16 font-black uppercase text-xs shadow-xl border-2 transition-all active:scale-95", 
                            emetteur.vesselStatus === 'emergency' ? "bg-orange-500 text-white" : "bg-slate-700 text-white border-slate-500")}
                        onClick={() => emetteur.triggerEmergency('PAN PAN')}
                      >
                          <AlertTriangle className="size-5 mr-2" /> PAN PAN
                      </Button>
                      <Button 
                        variant="outline" 
                        className="flex-1 h-16 font-black uppercase text-[10px] shadow-xl border-2 bg-white text-red-600 border-red-600 transition-all active:scale-95 leading-tight"
                        onClick={() => emetteur.triggerEmergency('ASSISTANCE')}
                      >
                          DEMANDE<br/>ASSISTANCE
                      </Button>
                  </div>
              )}

              <Accordion type="single" collapsible className="bg-white/95 backdrop-blur-md rounded-t-[2.5rem] shadow-[0_-8px_30px_rgba(0,0,0,0.2)] border-x-2 border-t-2 overflow-hidden">
                  <AccordionItem value="logs" className="border-none">
                      <AccordionTrigger className="h-12 px-6 hover:no-underline">
                          <div className="flex items-center gap-3">
                              <ClipboardList className="size-5 text-primary" />
                              <span className="text-sm font-black uppercase tracking-tighter text-slate-800">Cockpit : Journal &amp; Réglages</span>
                              <Badge variant="outline" className="bg-primary/5 border-primary/20 text-[8px] font-black animate-pulse">LIVE</Badge>
                          </div>
                      </AccordionTrigger>
                      <AccordionContent className="p-0">
                          <Tabs defaultValue="tactical" className="w-full">
                              <TabsList className="grid grid-cols-3 h-12 rounded-none bg-muted/20 border-y">
                                  <TabsTrigger value="tactical" className="text-[10px] font-black uppercase gap-2"><Fish className="size-3" /> Tactique</TabsTrigger>
                                  <TabsTrigger value="technical" className="text-[10px] font-black uppercase gap-2"><HistoryIcon className="size-3" /> Technique</TabsTrigger>
                                  <TabsTrigger value="settings" className="text-[10px] font-black uppercase gap-2 text-primary"><Settings className="size-3" /> Réglages Sons</TabsTrigger>
                              </TabsList>
                              
                              <TabsContent value="tactical" className="m-0 bg-white">
                                  <div className="p-4 space-y-4">
                                      <div className="grid grid-cols-4 gap-2">
                                          {TACTICAL_SPECIES.map(spec => (
                                              <Button key={spec.label} variant="outline" className="flex flex-col items-center justify-center gap-1 h-16 rounded-xl border-2 hover:bg-primary/5 active:scale-95 transition-all" onClick={() => emetteur.addTacticalLog(spec.label)}>
                                                  <spec.icon className="size-5 text-primary" />
                                                  <span className="text-[8px] font-black">{spec.label}</span>
                                              </Button>
                                          ))}
                                          <Button variant="secondary" className="flex flex-col items-center justify-center gap-1 h-16 rounded-xl border-2 border-primary/20 shadow-sm" onClick={() => photoInputRef.current?.click()}>
                                              <Camera className="size-5 text-primary" />
                                              <span className="text-[8px] font-black">PRISE</span>
                                          </Button>
                                      </div>
                                      <ScrollArea className="h-48 border-t pt-2 shadow-inner">
                                          <div className="space-y-1">
                                            {emetteur.tacticalLogs.map((log, i) => (
                                                <div key={i} className="p-3 border-b flex justify-between items-center text-[10px] cursor-pointer hover:bg-primary/5 active:bg-primary/10 transition-colors" onClick={() => mapCore.handleRecenter(log.pos)}>
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-1.5 bg-primary/10 rounded-lg"><Fish className="size-3 text-primary"/></div>
                                                        <span className="font-black uppercase text-primary">{log.type}</span>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        {log.wind && <span className="font-bold text-blue-600">{log.wind} ND</span>}
                                                        <span className="font-bold opacity-40">{format(log.time, 'HH:mm')}</span>
                                                    </div>
                                                </div>
                                            ))}
                                          </div>
                                      </ScrollArea>
                                  </div>
                              </TabsContent>

                              <TabsContent value="technical" className="m-0 bg-slate-50/50 p-4">
                                  <div className="flex items-center justify-between mb-4 bg-white p-3 rounded-xl border-2 shadow-sm">
                                      <div className="flex items-center gap-4">
                                          <div className="flex items-center gap-1.5"><Battery className="size-3 text-slate-400" /><span className="text-[10px] font-black">{emetteur.accuracy}m</span></div>
                                          <div className="flex items-center gap-1.5 border-l pl-4"><LocateFixed className="size-3 text-primary" /><span className="text-[10px] font-black uppercase text-primary">GPS FIX</span></div>
                                      </div>
                                      <Button variant="ghost" size="sm" className="h-7 text-destructive text-[8px] font-black uppercase border border-destructive/10" onClick={emetteur.clearLogs}><Trash2 className="size-3 mr-1" /> Effacer</Button>
                                  </div>
                                  <ScrollArea className="h-48 shadow-inner">
                                      <div className="space-y-2">
                                          <div className="p-2 border rounded-lg bg-green-50 text-[10px] font-black uppercase text-green-700">Système v40.0 prêt - En attente de signal GPS</div>
                                          {emetteur.techLogs.map((log, i) => (
                                              <div key={i} className="p-2 border rounded-lg bg-white flex justify-between items-center text-[9px] shadow-sm cursor-pointer hover:bg-slate-100" onClick={() => log.pos && mapCore.handleRecenter(log.pos)}>
                                                  <span className="font-black uppercase">{log.label}</span>
                                                  <span className="font-bold opacity-40">{format(log.time, 'HH:mm:ss')}</span>
                                              </div>
                                          ))}
                                      </div>
                                  </ScrollArea>
                              </TabsContent>

                              <TabsContent value="settings" className="m-0 bg-white p-4 space-y-6 overflow-y-auto max-h-[60vh] scrollbar-hide relative">
                                  <div className="sticky top-0 z-20 bg-white pb-4 border-b mb-2">
                                      <Button 
                                          className="w-full h-14 font-black uppercase tracking-widest shadow-xl gap-3 rounded-2xl bg-primary hover:bg-primary/90 text-white"
                                          onClick={async () => {
                                              const ok = await recepteur.savePrefsToFirestore();
                                              if (ok) {
                                                  toast({ 
                                                      title: "RÉGLAGES VALIDÉS", 
                                                      description: "Vos préférences sonores ont été enregistrées sur votre profil.",
                                                      variant: "default"
                                                  });
                                              } else {
                                                  toast({ 
                                                      variant: "destructive",
                                                      title: "Erreur",
                                                      description: "La sauvegarde a échoué. Vérifiez votre connexion."
                                                  });
                                              }
                                          }}
                                          disabled={recepteur.isSaving}
                                      >
                                          {recepteur.isSaving ? <RefreshCw className="size-5 animate-spin" /> : <CheckCircle2 className="size-6" />}
                                          ENREGISTRER ET VALIDER
                                      </Button>
                                  </div>

                                  <div className="flex items-center justify-between bg-primary/5 p-4 rounded-2xl border-2 border-primary/10">
                                      <div className="space-y-0.5">
                                          <Label className="text-xs font-black uppercase">Activer les signaux sonores globaux</Label>
                                          <p className="text-[8px] font-bold text-muted-foreground uppercase">Pilotage général du thread audio</p>
                                      </div>
                                      <Switch checked={recepteur.vesselPrefs.isNotifyEnabled} onCheckedChange={v => recepteur.updateLocalPrefs({ isNotifyEnabled: v })} />
                                  </div>

                                  <div className="space-y-3">
                                      <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
                                          <Volume2 className="size-3" /> Volume (Intensity {Math.round(recepteur.vesselPrefs.volume * 100)}%)
                                      </Label>
                                      <Slider value={[recepteur.vesselPrefs.volume * 100]} max={100} step={1} onValueChange={v => recepteur.updateLocalPrefs({ volume: v[0] / 100 })} />
                                  </div>

                                  <div className="space-y-4 p-4 border-2 rounded-2xl bg-slate-50">
                                      <div className="flex items-center justify-between">
                                          <Label className="text-[10px] font-black uppercase text-primary flex items-center gap-2"><Timer className="size-3" /> Veille Stratégique</Label>
                                          <Switch checked={recepteur.vesselPrefs.isWatchEnabled} onCheckedChange={v => recepteur.updateLocalPrefs({ isWatchEnabled: v })} />
                                      </div>
                                      <div className={cn("space-y-4", !recepteur.vesselPrefs.isWatchEnabled && "opacity-40 pointer-events-none")}>
                                          <div className="space-y-2">
                                              <div className="flex justify-between text-[9px] font-black uppercase"><span>Seuil d'immobilité</span><span>{recepteur.vesselPrefs.watchDuration >= 60 ? `${Math.floor(recepteur.vesselPrefs.watchDuration / 60)}h` : `${recepteur.vesselPrefs.watchDuration}m`}</span></div>
                                              <Slider value={[recepteur.vesselPrefs.watchDuration]} min={60} max={1440} step={60} onValueChange={v => recepteur.updateLocalPrefs({ watchDuration: v[0] })} />
                                          </div>
                                          <div className="flex items-center gap-2">
                                              <Select value={recepteur.vesselPrefs.watchSound} onValueChange={v => recepteur.updateLocalPrefs({ watchSound: v })}>
                                                  <SelectTrigger className="h-9 text-[10px] font-black uppercase w-full bg-white border-2">
                                                      <SelectValue placeholder="Son de veille..." />
                                                  </SelectTrigger>
                                                  <SelectContent>
                                                      {recepteur.availableSounds.map(s => <SelectItem key={s.id} value={s.label} className="text-[10px] uppercase font-black">{s.label}</SelectItem>)}
                                                  </SelectContent>
                                              </Select>
                                              <Button variant="ghost" size="icon" className="h-9 w-9 border-2" onClick={() => recepteur.playSound('watch')}><Play className="size-3" /></Button>
                                          </div>
                                      </div>
                                  </div>

                                  <div className="space-y-2 p-4 border-2 rounded-2xl bg-red-50/20 border-red-100">
                                      <Label className="text-[10px] font-black uppercase text-red-600 flex items-center gap-2"><Battery className="size-3" /> Seuil Batterie Faible</Label>
                                      <div className="flex items-center gap-4">
                                          <Slider className="flex-1" value={[recepteur.vesselPrefs.batteryThreshold]} min={5} max={90} step={5} onValueChange={v => recepteur.updateLocalPrefs({ batteryThreshold: v[0] })} />
                                          <Badge variant="outline" className="font-black text-xs bg-white">{recepteur.vesselPrefs.batteryThreshold}%</Badge>
                                      </div>
                                  </div>

                                  <div className="space-y-3 pt-2 border-t border-dashed">
                                      <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
                                          <HistoryIcon className="size-3" /> Réglages Individuels (Son 2.png)
                                      </p>
                                      <div className="grid gap-3">
                                          {Object.entries(recepteur.vesselPrefs.alerts || {}).map(([key, config]) => (
                                              <div key={key} className="p-3 border-2 rounded-xl space-y-3 bg-slate-50/50 shadow-sm">
                                                  <div className="flex items-center justify-between">
                                                      <Label className="text-[9px] font-black uppercase text-slate-700 flex items-center gap-2">
                                                          <Bell className="size-3" /> {key === 'moving' ? 'MOUVEMENT' : key === 'stationary' ? 'MOUILLAGE' : key === 'offline' ? 'SIGNAL PERDU' : key === 'assistance' ? 'ASSISTANCE' : key === 'tactical' ? 'SIGNAL TACTIQUE' : 'BATTERIE FAIBLE'}
                                                      </Label>
                                                      <Switch checked={config.enabled} onCheckedChange={v => recepteur.updateLocalPrefs({ alerts: { ...recepteur.vesselPrefs.alerts, [key]: { ...config, enabled: v } } })} className="scale-75" />
                                                  </div>
                                                  <div className={cn("flex items-center gap-2", !config.enabled && "opacity-40")}>
                                                      <Select value={config.sound} onValueChange={v => recepteur.updateLocalPrefs({ alerts: { ...recepteur.vesselPrefs.alerts, [key]: { ...config, sound: v } } })}>
                                                          <SelectTrigger className="h-8 text-[9px] font-black uppercase flex-1 bg-white border-2">
                                                              <SelectValue />
                                                          </SelectTrigger>
                                                          <SelectContent>
                                                              {recepteur.availableSounds.map(s => <SelectItem key={s.id} value={s.label} className="text-[9px] font-black uppercase">{s.label}</SelectItem>)}
                                                          </SelectContent>
                                                      </Select>
                                                      <div className="flex items-center gap-1 bg-white border-2 rounded-lg px-2 h-8">
                                                          <span className="text-[8px] font-black uppercase text-slate-400">Loop</span>
                                                          <Switch checked={config.loop} onCheckedChange={v => recepteur.updateLocalPrefs({ alerts: { ...recepteur.vesselPrefs.alerts, [key]: { ...config, loop: v } } })} className="scale-50" />
                                                      </div>
                                                      <Button variant="ghost" size="icon" className="h-8 w-8 border-2" onClick={() => recepteur.playSound(key as any)}><Play className="size-3" /></Button>
                                                  </div>
                                              </div>
                                          ))}
                                      </div>
                                  </div>
                              </TabsContent>
                          </Tabs>
                      </AccordionContent>
                  </AccordionItem>
              </Accordion>
          </div>
      </div>
    </div>
  );
}
