
'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useMapCore } from '@/logic/shared/useMapCore';
import { useEmetteur } from '@/logic/emetteur/useEmetteur';
import { useRecepteur } from '@/logic/recepteur/useRecepteur';
import { useFlotte } from '@/logic/flotteC/useFlotte';
import { GoogleMap, OverlayView, Polyline, Circle } from '@react-google-maps/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
  const { toast } = useToast();
  
  const mapCore = useMapCore();
  const emetteur = useEmetteur(
    (lat, lng) => {
        mapCore.updateBreadcrumbs(lat, lng);
        if (mapCore.isFollowMode && mapCore.googleMap) {
            mapCore.googleMap.panTo({ lat, lng });
        }
    },
    () => mapCore.clearBreadcrumbs() 
  );
  
  const recepteur = useRecepteur(emetteur.customSharingId);
  const flotte = useFlotte(emetteur.customSharingId, emetteur.vesselNickname);
  
  const photoInputRef = useRef<HTMLInputElement>(null);
  const hasCenteredInitially = useRef(false);

  // AUTO-CENTRAGE AU PREMIER SIGNAL GPS
  useEffect(() => {
    if (emetteur.currentPos && !hasCenteredInitially.current && mapCore.googleMap) {
        mapCore.handleRecenter(emetteur.currentPos);
        hasCenteredInitially.current = true;
    }
  }, [emetteur.currentPos, mapCore.googleMap]);

  // SYNC TACTIQUE
  useEffect(() => {
    const ids = [];
    if (emetteur.isSharing) ids.push(emetteur.customSharingId.toUpperCase() || 'MASTER');
    if (emetteur.customSharingId) ids.push(emetteur.customSharingId.toUpperCase());
    const unsub = mapCore.syncTacticalMarkers(ids);
    return () => unsub();
  }, [emetteur.isSharing, emetteur.customSharingId, mapCore]);

  // LED Clignotante
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

  const smsPreview = useMemo(() => {
    const nickname = (emetteur.vesselNickname || 'Navire').toUpperCase();
    const type = 'MAYDAY';
    const customText = (emetteur.isCustomMessageEnabled && emetteur.vesselSmsMessage) ? emetteur.vesselSmsMessage : "Demande assistance immédiate.";
    return `[${nickname}] ${customText} [${type}] Position : https://www.google.com/maps?q=-22.27,166.45`;
  }, [emetteur.vesselNickname, emetteur.isCustomMessageEnabled, emetteur.vesselSmsMessage]);

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

      {/* NAVIGATION MODES */}
      <div className="flex bg-slate-900 text-white p-1 rounded-xl shadow-lg border-2 border-primary/20 sticky top-0 z-[100]">
          <Button variant={appMode === 'sender' ? 'default' : 'ghost'} className="flex-1 font-black uppercase text-[10px] h-12" onClick={() => { setAppMode('sender'); recepteur.initAudio(); }}>Émetteur (A)</Button>
          <Button variant={appMode === 'receiver' ? 'default' : 'ghost'} className="flex-1 font-black uppercase text-[10px] h-12" onClick={() => { setAppMode('receiver'); recepteur.initAudio(); }}>Récepteur (B)</Button>
          <Button variant={appMode === 'fleet' ? 'default' : 'ghost'} className="flex-1 font-black uppercase text-[10px] h-12" onClick={() => { setAppMode('fleet'); recepteur.initAudio(); }}>Flotte (C)</Button>
      </div>

      {/* CARTE */}
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
                            <div style={{ transform: 'translate(-50%, -100%)' }} className="flex flex-col items-center group cursor-pointer z-[500]">
                                <div className="px-2 py-1 bg-white/90 backdrop-blur-md rounded border shadow-lg text-[8px] font-black uppercase opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap mb-1">
                                    {marker.type} - {marker.vesselName} • {format(marker.time, 'HH:mm')}
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
            <Button onClick={() => mapCore.setIsFollowMode(!mapCore.isFollowMode)} className={cn("h-10 w-10 border-2 shadow-xl rounded-xl", mapCore.isFollowMode ? "bg-primary text-white" : "bg-white text-primary")}>
                {mapCore.isFollowMode ? <Lock className="size-5" /> : <Unlock className="size-5" />}
            </Button>
            <Button onClick={handleRecenter} className="bg-white/90 border-2 h-10 w-10 text-primary shadow-xl rounded-xl hover:bg-white flex items-center justify-center">
                <LocateFixed className="size-5"/>
            </Button>
        </div>
      </div>

      {/* PANNEAUX DE CONTROLE */}
      <div className="grid grid-cols-1 gap-4">
          {appMode === 'sender' && (
              <Card className="border-2 shadow-lg rounded-2xl overflow-hidden">
                  <CardHeader className="bg-primary/5 p-4 border-b flex flex-row justify-between items-center">
                      <CardTitle className="text-xs font-black uppercase flex items-center gap-2"><Navigation className="size-4 text-primary" /> Identité & Partage</CardTitle>
                      {emetteur.isSharing && <div className={cn("size-3 rounded-full bg-green-500", isLedActive ? "animate-ping" : "opacity-30")} />}
                  </CardHeader>
                  <CardContent className="p-4 space-y-4">
                      {!emetteur.isSharing ? (
                          <div className="space-y-4">
                              <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase opacity-60">Surnom</Label><Input value={emetteur.vesselNickname} onChange={e => emetteur.setVesselNickname(e.target.value)} placeholder="EX: KOOLAPIK" className="h-11 border-2 font-black" /></div>
                              <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase opacity-60">ID Navire</Label><Input value={emetteur.customSharingId} onChange={e => emetteur.setCustomSharingId(e.target.value)} placeholder="ID UNIQUE" className="h-11 border-2 font-black text-center" /></div>
                              <Button className="w-full h-16 font-black uppercase text-base bg-primary rounded-2xl shadow-xl" onClick={emetteur.startSharing}>Lancer le Partage GPS</Button>
                          </div>
                      ) : (
                          <div className="space-y-4">
                              <div className="p-4 bg-primary/10 rounded-xl border-2 border-primary/20 text-center">
                                  <p className="text-[10px] font-black uppercase text-primary">Navire : {sharingId}</p>
                                  <Badge variant="outline" className="bg-green-500 text-white border-none animate-pulse mt-1">LIVE</Badge>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                  <Button variant="outline" className="h-14 font-black uppercase text-[10px] border-2" onClick={() => emetteur.triggerEmergency('ASSISTANCE')}>
                                      <Zap className="size-4 mr-2" /> Assistance
                                  </Button>
                                  <Button variant="outline" className={cn("h-14 font-black uppercase text-[10px] border-2", emetteur.vesselStatus === 'stationary' && "bg-orange-500 text-white")} onClick={emetteur.toggleAnchor}>
                                      <Anchor className="size-4 mr-2" /> Mouillage
                                  </Button>
                              </div>
                              <Button variant="destructive" className="w-full h-14 font-black uppercase rounded-xl border-2" onClick={emetteur.stopSharing}>Arrêter le partage</Button>
                          </div>
                      )}
                  </CardContent>
              </Card>
          )}

          <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="sms-safety" className="border-none">
                  <AccordionTrigger className="flex items-center gap-2 py-3 px-4 bg-orange-50 border-2 border-orange-100 rounded-xl hover:no-underline">
                      <Smartphone className="size-4 text-orange-600" />
                      <span className="text-[10px] font-black uppercase text-orange-800">Réglages d'Urgence (SMS)</span>
                  </AccordionTrigger>
                  <AccordionContent className="pt-4 space-y-4">
                      <div className="p-4 border-2 rounded-2xl bg-white space-y-4 shadow-inner">
                          <div className="space-y-1.5">
                              <Label className="text-[10px] font-black uppercase opacity-60">Numéro du contact à terre</Label>
                              <Input value={emetteur.emergencyContact} onChange={e => emetteur.setEmergencyContact(e.target.value)} placeholder="ex: 742929" className="h-12 border-2 font-black text-lg" />
                          </div>
                          <div className="space-y-1.5">
                              <Label className="text-[10px] font-black uppercase opacity-60">Message personnalisé</Label>
                              <Textarea value={emetteur.vesselSmsMessage} onChange={e => emetteur.setVesselSmsMessage(e.target.value)} placeholder="Détails du problème..." className="border-2 font-medium" />
                          </div>
                          <div className="space-y-2 pt-2 border-t border-dashed">
                              <p className="text-[9px] font-black uppercase text-primary flex items-center gap-2">
                                  <Eye className="size-3" /> Aperçu du message :
                              </p>
                              <div className="p-3 bg-muted/30 rounded-xl border-2 italic text-[10px] font-medium leading-relaxed text-slate-600">
                                  "{smsPreview}"
                              </div>
                          </div>
                          <Button className="w-full h-12 font-black uppercase tracking-widest bg-primary gap-2 shadow-lg">
                              <Save className="size-4" /> Sauvegarder réglages SMS
                          </Button>
                      </div>
                  </AccordionContent>
              </AccordionItem>
          </Accordion>
      </div>

      {/* COCKPIT DE BORD UNIFIÉ */}
      <div id="cockpit-logs" className="fixed bottom-16 left-0 right-0 z-[10001] px-1 pointer-events-none">
          <div className="max-w-2xl mx-auto pointer-events-auto">
              {/* BLOC URGENCE PRIORITAIRE */}
              {emetteur.isSharing && (
                  <div className="flex gap-2 mb-2 p-2 bg-slate-900/10 backdrop-blur-md rounded-2xl border-2 border-white/20 z-[10002] relative">
                      <Button 
                        variant={emetteur.vesselStatus === 'emergency' && emetteur.lastSyncTime ? 'default' : 'destructive'} 
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
                              <span className="text-sm font-black uppercase tracking-tighter">Cockpit & Journaux</span>
                              <Badge variant="outline" className="bg-primary/5 border-primary/20 text-[8px] font-black">LIVE</Badge>
                          </div>
                      </AccordionTrigger>
                      <AccordionContent className="p-0">
                          <Tabs defaultValue="tactical" className="w-full">
                              <TabsList className="grid w-full grid-cols-2 h-10 rounded-none bg-muted/20 border-y">
                                  <TabsTrigger value="tactical" className="text-[10px] font-black uppercase">Tactique (Carte)</TabsTrigger>
                                  <TabsTrigger value="technical" className="text-[10px] font-black uppercase">Technique (Boîte Noire)</TabsTrigger>
                              </TabsList>
                              
                              <TabsContent value="tactical" className="m-0 bg-white">
                                  <div className="p-4 space-y-4">
                                      <div className="grid grid-cols-4 gap-2">
                                          {TACTICAL_SPECIES.map(spec => (
                                              <Button key={spec.label} variant="outline" className="flex flex-col items-center justify-center gap-1 h-16 rounded-xl border-2 hover:bg-primary/5 active:scale-95" onClick={() => emetteur.addTacticalLog(spec.label)}>
                                                  <spec.icon className="size-5 text-primary" />
                                                  <span className="text-[8px] font-black">{spec.label}</span>
                                              </Button>
                                          ))}
                                          <Button variant="secondary" className="flex flex-col items-center justify-center gap-1 h-16 rounded-xl border-2 border-primary/20 shadow-sm" onClick={() => photoInputRef.current?.click()}>
                                              <Camera className="size-5 text-primary" />
                                              <span className="text-[8px] font-black">PRISE</span>
                                          </Button>
                                      </div>
                                      <ScrollArea className="h-40 border-t pt-2">
                                          {emetteur.tacticalLogs.map((log, i) => (
                                              <div key={i} className="p-2 border-b flex justify-between items-center text-[10px] cursor-pointer hover:bg-muted/50" onClick={() => mapCore.handleRecenter(log.pos)}>
                                                  <span className="font-black uppercase text-primary">{log.type}</span>
                                                  <span className="font-bold opacity-40">{format(log.time, 'HH:mm')}</span>
                                              </div>
                                          ))}
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
                                  <ScrollArea className="h-40">
                                      <div className="space-y-2">
                                          <div className="p-2 border rounded-lg bg-green-50 text-[10px] font-black uppercase text-green-700">Système v40.0 prêt - En attente de signal GPS</div>
                                          {emetteur.techLogs.map((log, i) => (
                                              <div key={i} className="p-2 border rounded-lg bg-white flex justify-between items-center text-[9px] shadow-sm">
                                                  <span className="font-black uppercase">{log.label}</span>
                                                  <span className="font-bold opacity-40">{format(log.time, 'HH:mm:ss')}</span>
                                              </div>
                                          ))}
                                      </div>
                                  </ScrollArea>
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
