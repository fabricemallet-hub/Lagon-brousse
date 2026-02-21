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
  BatteryCharging,
  BatteryLow,
  BatteryMedium,
  WifiOff,
  Volume2,
  Timer,
  Bell,
  Eye,
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
  }, [emetteur.currentPos, mapCore.googleMap, mapCore]);

  // Sync LED Clignotante pour l'émetteur
  const [isLedActive, setIsLedActive] = useState(false);
  useEffect(() => {
    if (emetteur.lastSyncTime > 0) {
      setIsLedActive(true);
      const timer = setTimeout(() => setIsLedActive(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [emetteur.lastSyncTime]);

  const handleStartSharingExtended = () => {
    emetteur.startSharing();
    mapCore.setIsFollowMode(true);
    if (emetteur.currentPos) {
        mapCore.handleRecenter(emetteur.currentPos);
    }
    toast({ title: "Partage Actif", description: "GPS & Verrouillage activés." });
  };

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

      {/* NAVIGATION MODES */}
      <div className="flex bg-slate-900 text-white p-1 rounded-xl shadow-lg border-2 border-primary/20 sticky top-0 z-[100]">
          <Button variant={appMode === 'sender' ? 'default' : 'ghost'} className="flex-1 font-black uppercase text-[9px] sm:text-[10px] h-12 px-1" onClick={() => { setAppMode('sender'); recepteur.initAudio(); }}>Émetteur (A)</Button>
          <Button variant={appMode === 'receiver' ? 'default' : 'ghost'} className="flex-1 font-black uppercase text-[9px] sm:text-[10px] h-12 px-1" onClick={() => { setAppMode('receiver'); recepteur.initAudio(); }}>Récepteur (B)</Button>
          <Button variant={appMode === 'fleet' ? 'default' : 'ghost'} className="flex-1 font-black uppercase text-[9px] sm:text-[10px] h-12 px-1" onClick={() => { setAppMode('fleet'); recepteur.initAudio(); }}>Flotte (C)</Button>
      </div>

      {/* NAVIGATION CALQUES */}
      <div className="flex bg-muted/30 p-1 rounded-xl border relative z-20">
          <Button variant={mapCore.viewMode === 'alpha' ? 'default' : 'ghost'} className="flex-1 font-black uppercase text-[10px] h-10" onClick={() => mapCore.setViewMode('alpha')}>Alpha (Maps)</Button>
          <Button variant={mapCore.viewMode === 'beta' ? 'default' : 'ghost'} className="flex-1 font-black uppercase text-[10px] h-10" onClick={() => mapCore.setViewMode('beta')}>Béta (Météo)</Button>
          <Button variant={mapCore.viewMode === 'gamma' ? 'default' : 'ghost'} className="flex-1 font-black uppercase text-[10px] h-10" onClick={() => mapCore.setViewMode('gamma')}>Gamma (Full)</Button>
      </div>

      {!recepteur.audioAuthorized && (
          <Alert className="bg-primary/10 border-primary/20 animate-in fade-in">
              <Zap className="size-4 text-primary" />
              <AlertDescription className="text-[10px] font-black uppercase">Interagissez avec la page pour activer les alertes sonores.</AlertDescription>
          </Alert>
      )}

      {/* CONTENEUR CARTE */}
      <div className={cn("relative w-full rounded-[2.5rem] border-4 border-slate-900 shadow-2xl overflow-hidden bg-slate-100 transition-all", mapCore.isFullscreen ? "fixed inset-0 z-[150] h-screen" : "h-[500px]")}>
        {mapCore.isGoogleLoaded ? (
            <GoogleMap
                mapContainerClassName="w-full h-full"
                defaultCenter={INITIAL_CENTER}
                defaultZoom={12}
                onLoad={mapCore.setGoogleMap}
                onDragStart={() => mapCore.setIsFollowMode(false)}
                onIdle={mapCore.saveMapState}
                options={{ 
                    disableDefaultUI: true, 
                    mapTypeId: mapCore.viewMode === 'alpha' ? 'hybrid' : 'roadmap', 
                    gestureHandling: 'greedy' 
                }}
            >
                {/* POINT BLEU */}
                {emetteur.currentPos && (
                    <OverlayView position={emetteur.currentPos} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                        <div style={{ transform: 'translate(-50%, -50%)' }} className="relative">
                            <div className="size-10 bg-blue-500/20 rounded-full animate-ping absolute inset-0" />
                            <div className="size-6 bg-blue-500 border-4 border-white rounded-full shadow-lg flex items-center justify-center">
                                <Navigation className="size-3 text-white fill-white" />
                            </div>
                        </div>
                    </OverlayView>
                )}

                {/* BREADCRUMBS */}
                {mapCore.breadcrumbs.length > 1 && (
                    <Polyline 
                        path={mapCore.breadcrumbs} 
                        options={{ strokeColor: "#3b82f6", strokeOpacity: 0.6, strokeWeight: 2 }} 
                    />
                )}

                {/* MOUILLAGE */}
                {emetteur.anchorPos && (
                    <>
                        <OverlayView position={emetteur.anchorPos} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                            <div style={{ transform: 'translate(-50%, -50%)' }} className="size-8 bg-orange-500 rounded-full border-2 border-white flex items-center justify-center shadow-lg">
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
        
        {/* BOUTONS FLOTTANTS */}
        <div className="absolute top-4 left-4 z-[9999] flex flex-col gap-2">
            <Button size="icon" className="bg-white/90 border-2 h-10 w-10 text-primary shadow-xl rounded-xl hover:bg-white" onClick={() => mapCore.setIsFullscreen(!mapCore.isFullscreen)}>
                {mapCore.isFullscreen ? <Shrink className="size-5" /> : <Expand className="size-5" />}
            </Button>
        </div>
        <div className="absolute top-4 right-4 z-[9999] flex flex-col gap-2">
            <Button onClick={() => mapCore.setIsFollowMode(!mapCore.isFollowMode)} className={cn("h-10 w-10 border-2 shadow-xl rounded-xl transition-all", mapCore.isFollowMode ? "bg-primary text-white border-primary" : "bg-white text-primary")}>
                {mapCore.isFollowMode ? <Lock className="size-5" /> : <Unlock className="size-5" />}
            </Button>
            {!mapCore.isFollowMode && (
                <Button onClick={handleRecenter} className="bg-white/90 backdrop-blur-sm border-2 font-black text-[9px] uppercase gap-2 px-3 h-10 text-primary shadow-xl rounded-xl hover:bg-white">
                    <LocateFixed className="size-4"/> RE-CENTRER
                </Button>
            )}
        </div>
      </div>

      {/* PANNEAUX DE CONTROLE */}
      <div className="grid grid-cols-1 gap-4">
          <Tabs value={appMode} className="w-full">
              <TabsContent value="sender" className="space-y-4 m-0">
                  <Card className="border-2 shadow-lg rounded-2xl overflow-hidden">
                      <CardHeader className="bg-primary/5 p-4 border-b">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-xs font-black uppercase flex items-center gap-2">
                                <Navigation className="size-4 text-primary" /> Identité & Partage GPS
                            </CardTitle>
                            {emetteur.isSharing && (
                                <div className="flex items-center gap-2">
                                    <div className={cn("size-2.5 rounded-full bg-green-500 transition-all shadow-sm", isLedActive ? "opacity-100 scale-125 shadow-[0_0_8px_rgba(34,197,94,0.8)]" : "opacity-30 scale-100")} />
                                    <span className="text-[8px] font-black text-green-600 uppercase">Sync Active</span>
                                </div>
                            )}
                        </div>
                      </CardHeader>
                      <CardContent className="p-4 space-y-4">
                          {!emetteur.isSharing ? (
                              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                                  <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase opacity-60 ml-1">Surnom du Navire</Label><Input value={emetteur.vesselNickname} onChange={e => emetteur.setVesselNickname(e.target.value)} placeholder="EX: KOOLAPIK" className="h-11 border-2 font-black uppercase" /></div>
                                  <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase opacity-60 ml-1">ID Navire (Partage Direct)</Label><Input value={emetteur.customSharingId} onChange={e => emetteur.setCustomSharingId(e.target.value)} placeholder="ID UNIQUE" className="h-11 border-2 font-black uppercase text-center tracking-widest" /></div>
                                  
                                  <div className="space-y-3">
                                      <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Historique des IDs</p>
                                      <div className="flex flex-wrap gap-2">
                                          {emetteur.vesselHistory.map(id => (
                                              <Badge key={id} variant="outline" className="h-8 px-3 cursor-pointer bg-white border-2 hover:bg-primary/5 gap-2" onClick={() => emetteur.handleSelectFromHistory(id)}>
                                                  <span className="font-mono text-[9px]">{id}</span>
                                                  <X className="size-3 text-destructive opacity-40 hover:opacity-100" onClick={(e) => { e.stopPropagation(); emetteur.deleteFromHistory(id); }} />
                                              </Badge>
                                          ))}
                                      </div>
                                  </div>

                                  <Button className="w-full h-16 font-black uppercase tracking-widest shadow-xl text-base bg-primary hover:bg-primary/90 rounded-2xl" onClick={handleStartSharingExtended}>Démarrer le Partage GPS</Button>
                              </div>
                          ) : (
                              <div className="space-y-4">
                                  <div className="p-4 bg-primary/10 rounded-xl border-2 border-primary/20 flex flex-col items-center text-center gap-1">
                                      <p className="text-[10px] font-black uppercase text-primary">Navire en cours de partage</p>
                                      <p className="text-xl font-black uppercase">{emetteur.customSharingId || 'MASTER'}</p>
                                      <Badge variant="outline" className="bg-green-500 text-white border-none text-[8px] animate-pulse">EN LIGNE</Badge>
                                  </div>
                                  
                                  <div className="grid grid-cols-2 gap-2">
                                      <Button variant="outline" className="h-14 font-black uppercase text-[10px] border-2 bg-indigo-50 text-indigo-700 shadow-sm" onClick={() => emetteur.setManualStatus('returning', 'RETOUR MAISON')}>
                                        <Navigation className="size-4 mr-2" /> Retour Maison
                                      </Button>
                                      <Button variant="outline" className="h-14 font-black uppercase text-[10px] border-2 bg-green-50 text-green-700 shadow-sm" onClick={() => emetteur.setManualStatus('landed', 'À TERRE')}>
                                        <Home className="size-4 mr-2" /> Home (À terre)
                                      </Button>
                                  </div>

                                  <div className="grid grid-cols-2 gap-2">
                                      <Button 
                                        variant={emetteur.vesselStatus === 'stationary' ? 'default' : 'outline'} 
                                        className={cn("h-14 font-black uppercase text-[10px] border-2", emetteur.vesselStatus === 'stationary' ? "bg-orange-500 text-white border-orange-600" : "bg-white text-orange-600 border-orange-200")} 
                                        onClick={emetteur.toggleAnchor}
                                      >
                                        <Anchor className="size-4 mr-2" /> {emetteur.vesselStatus === 'stationary' ? 'Mouillage Actif' : 'Activer Mouillage'}
                                      </Button>
                                      <div className="p-2 border-2 rounded-xl bg-muted/10 space-y-1">
                                          <Label className="text-[8px] font-black uppercase opacity-60">Rayon Dérive: {emetteur.mooringRadius}m</Label>
                                          <Slider value={[emetteur.mooringRadius]} min={10} max={200} step={10} onValueChange={v => emetteur.setMooringRadius(v[0])} />
                                      </div>
                                  </div>

                                  <Button variant="destructive" className="w-full h-16 font-black uppercase tracking-widest shadow-xl rounded-2xl border-2 border-white/20" onClick={emetteur.stopSharing}>
                                    <X className="size-5" /> Arrêter le partage
                                  </Button>
                              </div>
                          )}
                      </CardContent>
                  </Card>
              </TabsContent>

              <TabsContent value="receiver" className="m-0 space-y-4">
                  <Card className="border-2 shadow-lg rounded-2xl overflow-hidden min-h-[400px]">
                      <CardHeader className="bg-slate-900 text-white p-4">
                          <CardTitle className="text-xs font-black uppercase">Surveillance Récepteur</CardTitle>
                      </CardHeader>
                      <ScrollArea className="h-[350px]">
                          <div className="p-3 space-y-2">
                              {recepteur.techLogs.length > 0 ? recepteur.techLogs.map((log, i) => (
                                  <div key={i} className="p-3 bg-white border-2 rounded-xl flex items-center justify-between shadow-sm">
                                      <div className="flex flex-col">
                                        <span className={cn("font-black text-[10px] uppercase", log.label === 'DÉRIVE' ? 'text-red-600' : 'text-primary')}>{log.label}</span>
                                        <span className="text-[8px] font-bold opacity-40">{log.time ? format(log.time.toDate ? log.time.toDate() : log.time, 'HH:mm:ss') : '...'}</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                          <span className="text-[9px] font-black">{log.battery}%</span>
                                          <BatteryIconComp level={log.battery} />
                                      </div>
                                  </div>
                              )) : <div className="py-20 text-center opacity-20"><RefreshCw className="size-8 mx-auto mb-2" /><p className="text-[10px] font-black uppercase">Attente de données...</p></div>}
                          </div>
                      </ScrollArea>
                  </Card>
              </TabsContent>

              <TabsContent value="fleet" className="m-0 space-y-4">
                  <Card className="border-2 shadow-lg rounded-2xl overflow-hidden min-h-[400px]">
                      <CardHeader className="bg-slate-900 text-white p-4">
                          <CardTitle className="text-xs font-black uppercase">Journal Tactique Flotte</CardTitle>
                      </CardHeader>
                      <ScrollArea className="h-[350px]">
                          <div className="p-3 space-y-3">
                              {flotte.tacticalLogs.map((log, i) => (
                                  <div key={i} className="p-3 bg-white border-2 rounded-xl flex items-center justify-between shadow-sm">
                                      <div className="flex items-center gap-3">
                                          <div className="p-2 bg-primary/10 rounded-lg"><Fish className="size-4 text-primary"/></div>
                                          <div className="flex flex-col">
                                              <span className="font-black text-xs uppercase text-primary">{log.type}</span>
                                              <span className="text-[8px] font-bold opacity-40 uppercase">{log.sender}</span>
                                          </div>
                                      </div>
                                      <div className="text-right">
                                          <p className="text-[10px] font-black text-blue-600">{log.wind} ND</p>
                                          <p className="text-[8px] font-bold opacity-40">{log.time ? format(log.time.toDate ? log.time.toDate() : log.time, 'HH:mm') : '...'}</p>
                                      </div>
                                  </div>
                              ))}
                          </div>
                      </ScrollArea>
                  </Card>
              </TabsContent>
          </Tabs>

          {/* RÉGLAGES AUDIO */}
          <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="audio-prefs" className="border-none">
                  <AccordionTrigger className="flex items-center gap-2 hover:no-underline py-3 px-4 bg-muted/5 rounded-xl">
                      <Volume2 className="size-4 text-primary" />
                      <span className="text-[10px] font-black uppercase">Alertes Audio & Veille</span>
                  </AccordionTrigger>
                  <AccordionContent className="pt-4 space-y-6">
                      <Card className="p-4 border-2 rounded-2xl space-y-6 bg-white shadow-inner">
                          <div className="space-y-4">
                              <div className="flex items-center justify-between border-b pb-2">
                                  <Label className="text-[10px] font-black uppercase text-primary flex items-center gap-2">
                                      <Timer className="size-3" /> Veille Stratégique
                                  </Label>
                                  <Badge variant="outline" className="font-black bg-white">{recepteur.vesselPrefs.watchDuration >= 60 ? `${Math.floor(recepteur.vesselPrefs.watchDuration / 60)}h` : `${recepteur.vesselPrefs.watchDuration}m`}</Badge>
                              </div>
                              <Slider 
                                value={[recepteur.vesselPrefs.watchDuration]} 
                                min={1} max={1440} step={60}
                                onValueChange={v => recepteur.savePrefs({ watchDuration: v[0] })}
                              />
                              <div className="flex items-center gap-4">
                                  <Select value={recepteur.vesselPrefs.watchSound} onValueChange={v => recepteur.savePrefs({ watchSound: v })}>
                                      <SelectTrigger className="h-9 text-[10px] font-black uppercase w-full bg-slate-50 border-2">
                                          <SelectValue placeholder="Son de veille..." />
                                      </SelectTrigger>
                                      <SelectContent>
                                          {recepteur.availableSounds.map(s => <SelectItem key={s.id} value={s.label.toLowerCase()} className="text-[10px] uppercase font-black">{s.label}</SelectItem>)}
                                      </SelectContent>
                                  </Select>
                                  <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 border-2" onClick={() => recepteur.playSound('watch')}>
                                      <Play className="size-3" />
                                  </Button>
                              </div>
                          </div>

                          <div className="space-y-4 border-t pt-4">
                              <div className="flex items-center justify-between border-b pb-2">
                                  <Label className="text-[10px] font-black uppercase text-red-600 flex items-center gap-2">
                                      <Battery className="size-3" /> Seuil Batterie Faible
                                  </Label>
                                  <Badge variant="outline" className="font-black bg-red-50 text-red-600 border-red-100">{recepteur.vesselPrefs.batteryThreshold}%</Badge>
                              </div>
                              <Slider 
                                value={[recepteur.vesselPrefs.batteryThreshold]} 
                                min={5} max={90} step={5}
                                onValueChange={v => recepteur.savePrefs({ batteryThreshold: v[0] })}
                              />
                          </div>

                          <div className="space-y-4 pt-4 border-t">
                              <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Réglages Sons Individuels</p>
                              <div className="grid gap-3">
                                  {Object.entries(recepteur.vesselPrefs?.alerts || {}).map(([key, config]) => (
                                      <div key={key} className="p-3 border-2 rounded-xl space-y-3 bg-slate-50/50">
                                          <div className="flex items-center justify-between">
                                              <Label className="text-[9px] font-black uppercase text-slate-700 flex items-center gap-2">
                                                  <Bell className="size-3" /> {key.toUpperCase()}
                                              </Label>
                                              <Switch 
                                                checked={config.enabled} 
                                                onCheckedChange={v => recepteur.savePrefs({ alerts: { ...recepteur.vesselPrefs.alerts, [key]: { ...config, enabled: v } } })} 
                                                className="scale-75"
                                              />
                                          </div>
                                          <div className="flex items-center gap-2">
                                              <Select value={config.sound} onValueChange={v => recepteur.savePrefs({ alerts: { ...recepteur.vesselPrefs.alerts, [key]: { ...config, sound: v } } })}>
                                                  <SelectTrigger className="h-8 text-[9px] font-black uppercase flex-grow bg-white border-2">
                                                      <SelectValue />
                                                  </SelectTrigger>
                                                  <SelectContent>
                                                      {recepteur.availableSounds.map(s => <SelectItem key={s.id} value={s.label.toLowerCase()} className="text-[9px] uppercase font-black">{s.label}</SelectItem>)}
                                                  </SelectContent>
                                              </Select>
                                              <Button variant="ghost" size="icon" className="h-8 w-8 border-2 bg-white" onClick={() => recepteur.playSound(key as any)}>
                                                  <Play className="size-3" />
                                              </Button>
                                          </div>
                                      </div>
                                  ))}
                              </div>
                          </div>
                      </Card>
                  </AccordionContent>
              </AccordionItem>
          </Accordion>
      </div>

      <input type="file" accept="image/*" capture="environment" ref={photoInputRef} className="hidden" onChange={e => {
          const file = e.target.files?.[0];
          if (file) {
              const reader = new FileReader();
              reader.onload = (ev) => emetteur.addTacticalLog('PHOTO', ev.target?.result as string);
              reader.readAsDataURL(file);
          }
      }} />

      {/* ANNUAIRE */}
      <Card className="border-2 shadow-sm bg-muted/5">
          <CardHeader className="p-4 pb-2 border-b"><CardTitle className="text-[10px] font-black uppercase flex items-center gap-2"><Phone className="size-3" /> Annuaire Maritime NC</CardTitle></CardHeader>
          <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="space-y-2"><p className="text-[9px] font-black uppercase text-red-600 border-b pb-1">Urgences</p><p className="text-xs font-black">COSS Mer : 16</p><p className="text-xs font-black">SAMU Terre : 15</p></div>
              <div className="space-y-2"><p className="text-[9px] font-black uppercase text-blue-600 border-b pb-1">Services</p><p className="text-xs font-black">Météo Marine : 36 67 36</p></div>
              <div className="space-y-2"><p className="text-[9px] font-black uppercase text-indigo-600 border-b pb-1">VHF</p><p className="text-xs font-black">Port Autonome : Canal 12</p></div>
          </CardContent>
      </Card>

      {/* JOURNAUX DE BORD - FIXE AU BAS (Z-INDEX 10001) */}
      <div className="fixed bottom-16 left-0 right-0 z-[10001] pointer-events-none px-1">
          <div className="max-w-2xl mx-auto pointer-events-auto">
              <Accordion type="single" collapsible className="bg-white/95 backdrop-blur-md rounded-t-[2.5rem] shadow-[0_-8px_30px_rgba(0,0,0,0.2)] border-x-2 border-t-2">
                  <AccordionItem value="logs" className="border-none">
                      <AccordionTrigger className="h-12 px-6 hover:no-underline">
                          <div className="flex items-center gap-3">
                              <ClipboardList className="size-5 text-primary" />
                              <span className="text-sm font-black uppercase tracking-tighter">Journal de Bord Unifié</span>
                              <Badge variant="outline" className="bg-primary/5 border-primary/20 text-[8px] font-black">LIVE</Badge>
                          </div>
                      </AccordionTrigger>
                      <AccordionContent className="p-0">
                          <Tabs defaultValue="tactical" className="w-full">
                              <TabsList className="grid w-full grid-cols-2 h-10 rounded-none bg-muted/20 border-y">
                                  <TabsTrigger value="tactical" className="text-[10px] font-black uppercase">Tactique</TabsTrigger>
                                  <TabsTrigger value="technical" className="text-[10px] font-black uppercase">Technique</TabsTrigger>
                              </TabsList>
                              
                              <TabsContent value="tactical" className="m-0 bg-white">
                                  <div className="p-4 space-y-4">
                                      {/* GRILLE DE CAPTURE TACTIQUE */}
                                      <div className="grid grid-cols-4 gap-2">
                                          {TACTICAL_SPECIES.map(spec => (
                                              <Button 
                                                key={spec.label} 
                                                variant="outline" 
                                                className="flex flex-col items-center justify-center gap-1 h-16 rounded-xl border-2 hover:bg-primary/5 active:scale-95 transition-all"
                                                onClick={() => emetteur.addTacticalLog(spec.label)}
                                              >
                                                  <spec.icon className="size-5 text-primary" />
                                                  <span className="text-[8px] font-black">{spec.label}</span>
                                              </Button>
                                          ))}
                                          <Button 
                                            variant="secondary" 
                                            className="flex flex-col items-center justify-center gap-1 h-16 rounded-xl border-2 border-primary/20 shadow-sm"
                                            onClick={() => photoInputRef.current?.click()}
                                          >
                                              <Camera className="size-5 text-primary" />
                                              <span className="text-[8px] font-black">PRISE</span>
                                          </Button>
                                      </div>

                                      <ScrollArea className="h-[200px] border-t pt-2">
                                          <div className="space-y-2">
                                              {emetteur.tacticalLogs.length > 0 ? emetteur.tacticalLogs.map((log, i) => (
                                                  <div 
                                                    key={i} 
                                                    className="p-3 bg-slate-50 border-2 rounded-xl flex items-center justify-between cursor-pointer active:bg-slate-100"
                                                    onClick={() => mapCore.handleRecenter(log.pos)}
                                                  >
                                                      <div className="flex items-center gap-3">
                                                          <div className="p-2 bg-primary/10 rounded-lg"><Fish className="size-4 text-primary" /></div>
                                                          <div className="flex flex-col">
                                                              <span className="font-black text-[10px] uppercase text-slate-800">{log.type}</span>
                                                              <span className="text-[8px] font-bold opacity-40 uppercase">{format(log.time, 'HH:mm')}</span>
                                                          </div>
                                                      </div>
                                                      <LocateFixed className="size-3 text-primary/40" />
                                                  </div>
                                              )) : (
                                                  <div className="py-10 text-center opacity-30 italic text-[10px] uppercase font-black">Aucune prise enregistrée</div>
                                              )}
                                          </div>
                                      </ScrollArea>
                                  </div>
                              </TabsContent>

                              <TabsContent value="technical" className="m-0 bg-slate-50/50">
                                  <div className="p-4 space-y-4">
                                      <div className="flex items-center justify-between bg-white p-3 rounded-xl border-2 shadow-sm">
                                          <div className="flex items-center gap-4">
                                              <div className="flex items-center gap-1.5">
                                                  <Battery className="size-3 text-slate-400" />
                                                  <span className="text-[10px] font-black">{emetteur.accuracy > 0 ? `${emetteur.accuracy}m` : 'Wait...'}</span>
                                              </div>
                                              <div className="flex items-center gap-1.5 border-l pl-4">
                                                  <LocateFixed className="size-3 text-primary" />
                                                  <span className="text-[10px] font-black uppercase text-primary">GPS FIX</span>
                                              </div>
                                          </div>
                                          <Button variant="ghost" size="sm" className="h-7 text-destructive text-[8px] font-black uppercase border border-destructive/10" onClick={emetteur.clearLogs}>
                                              <Trash2 className="size-3 mr-1" /> Effacer
                                          </Button>
                                      </div>

                                      <ScrollArea className="h-[200px]">
                                          <div className="space-y-2">
                                              {emetteur.techLogs.map((log, i) => (
                                                  <div key={i} className="p-2.5 bg-white border rounded-lg flex items-center justify-between text-[9px] shadow-sm">
                                                      <div className="flex flex-col gap-0.5">
                                                          <div className="flex items-center gap-2">
                                                              <span className={cn("font-black uppercase", log.label === 'SYSTÈME' ? 'text-primary' : 'text-slate-600')}>{log.label}</span>
                                                              <span className="text-[8px] font-bold opacity-40">{format(log.time, 'HH:mm:ss')}</span>
                                                          </div>
                                                          <span className="text-slate-500 font-medium italic">"{log.details}"</span>
                                                      </div>
                                                      {log.pos && <LocateFixed className="size-3 text-primary/20" />}
                                                  </div>
                                              ))}
                                          </div>
                                      </ScrollArea>
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

function BatteryIconComp({ level, charging, className }: { level?: number; charging?: boolean; className?: string }) {
  const props = { className: cn('w-4 h-4', className) };
  if (charging) return <BatteryCharging {...props} className="text-blue-500" />;
  if (level !== undefined && level < 20) return <BatteryLow {...props} className="text-red-500" />;
  if (level !== undefined && level < 60) return <BatteryMedium {...props} className="text-amber-500" />;
  return <BatteryFull {...props} className="text-green-500" />;
}
