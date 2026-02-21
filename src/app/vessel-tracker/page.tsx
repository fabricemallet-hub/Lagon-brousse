'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useVesselLogic } from '@/hooks/use-vessel-logic';
import { useVesselUI } from '@/hooks/use-vessel-ui';
import { useGoogleMaps } from '@/context/google-maps-context';
import { GoogleMap, OverlayView, Polyline, Circle } from '@react-google-maps/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Navigation, Anchor, LocateFixed, ShieldAlert, Expand, Shrink, Zap, AlertTriangle,
  BatteryFull, BatteryMedium, BatteryLow, BatteryCharging, History, MapPin, 
  X, Play, VolumeX, RefreshCw, Home, Settings, Smartphone, Bird, Target, 
  Compass, Fish, Camera, Ghost, Users, Eye, EyeOff, Phone, Waves, Lock, Unlock, Save
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const INITIAL_CENTER = { lat: -21.3, lng: 165.5 };

export default function VesselTrackerPage() {
  const logic = useVesselLogic();
  const ui = useVesselUI(logic.sharingId, logic.vesselNickname);
  const { isLoaded: isGoogleLoaded } = useGoogleMaps();

  const [googleMap, setGoogleMap] = useState<google.maps.Map | null>(null);
  const [isFollowMode, setIsFollowMode] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Effet de centrage au lancement ou lock
  useEffect(() => {
    if (isFollowMode && logic.currentPos && googleMap) {
        googleMap.panTo(logic.currentPos);
    }
  }, [isFollowMode, logic.currentPos, googleMap]);

  return (
    <div className="w-full space-y-4 pb-32 px-1">
      {/* ALERTE SONORE CRITIQUE */}
      {ui.activeAlarm && (
          <Button variant="destructive" className="fixed top-12 left-4 right-4 z-[300] h-16 font-black uppercase text-sm animate-pulse shadow-2xl border-4 border-white" onClick={ui.stopAlarm}>
              <VolumeX className="size-6 mr-3" /> ARRÊTER LE SON (ALARME ACTIVE)
          </Button>
      )}

      {/* BANNIÈRE AUDIO */}
      {!ui.audioAuthorized && (
          <Alert className="bg-primary/10 border-primary/20 animate-in fade-in z-[200]">
              <Zap className="size-4 text-primary" />
              <AlertDescription className="text-[10px] font-black uppercase">Interagissez avec la page (cliquez sur Démarrer) pour autoriser les alertes.</AlertDescription>
          </Alert>
      )}

      {/* SÉLECTEUR DE MODE CARTE */}
      <div className="flex bg-muted/30 p-1 rounded-xl border z-20 relative">
          <Button variant={ui.viewMode === 'alpha' ? 'default' : 'ghost'} className="flex-1 font-black uppercase text-[10px] h-12" onClick={() => ui.setViewMode('alpha')}>Alpha (Maps)</Button>
          <Button variant={ui.viewMode === 'beta' ? 'default' : 'ghost'} className="flex-1 font-black uppercase text-[10px] h-12" onClick={() => ui.setViewMode('beta')}>Béta (Météo)</Button>
          <Button variant={ui.viewMode === 'gamma' ? 'default' : 'ghost'} className="flex-1 font-black uppercase text-[10px] h-12" onClick={() => ui.setViewMode('gamma')}>Gamma (Windy)</Button>
      </div>

      {/* CONTENEUR CARTE */}
      <div className={cn("relative w-full rounded-[2.5rem] border-4 border-slate-900 shadow-2xl overflow-hidden bg-slate-100 transition-all", isFullscreen ? "fixed inset-0 z-[150] h-screen" : "h-[500px]")}>
        <div id="windy" className={cn("absolute inset-0 z-10", ui.viewMode === 'alpha' && "hidden")}></div>
        
        {isGoogleLoaded && (
            <GoogleMap
                mapContainerClassName={cn("w-full h-full", ui.viewMode === 'gamma' && "hidden")}
                defaultCenter={INITIAL_CENTER}
                defaultZoom={12}
                onLoad={setGoogleMap}
                onDragStart={() => setIsFollowMode(false)}
                options={{ disableDefaultUI: true, mapTypeId: 'hybrid', gestureHandling: 'greedy' }}
            >
                {/* BREADCRUMBS (Trace bleue 30 min) */}
                {logic.breadcrumbs.length > 1 && (
                    <Polyline path={logic.breadcrumbs.map(p => ({ lat: p.lat, lng: p.lng }))} options={{ strokeColor: "#3b82f6", strokeOpacity: 0.6, strokeWeight: 2 }} />
                )}
                
                {/* POSITION RÉELLE */}
                {logic.currentPos && (
                    <OverlayView position={logic.currentPos} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                        <div style={{ transform: `translate(-50%, -50%) rotate(${logic.currentHeading}deg)` }} className="relative">
                            <div className="size-10 bg-blue-500/20 rounded-full animate-ping absolute inset-0" />
                            <div className="size-6 bg-blue-500 border-4 border-white rounded-full shadow-lg flex items-center justify-center">
                                <Navigation className="size-3 text-white fill-white" />
                            </div>
                        </div>
                    </OverlayView>
                )}

                {/* ANCRE & CERCLE DE MOUILLAGE */}
                {logic.anchorPos && (
                    <>
                        <OverlayView position={logic.anchorPos} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                            <div style={{ transform: 'translate(-50%, -50%)' }} className="size-8 bg-orange-500 rounded-full border-2 border-white flex items-center justify-center shadow-lg">
                                <Anchor className="size-4 text-white" />
                            </div>
                        </OverlayView>
                        <Circle center={logic.anchorPos} radius={logic.mooringRadius} options={{ strokeColor: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.15, strokeWidth: 1 }} />
                    </>
                )}
            </GoogleMap>
        )}
        
        {/* BOUTONS FLOTTANTS CARTE */}
        <div className="absolute top-4 left-4 flex flex-col gap-2 z-[200]">
            <Button size="icon" className="bg-white/90 border-2 h-10 w-10 shadow-xl" onClick={() => setIsFullscreen(!isFullscreen)}>{isFullscreen ? <Shrink className="size-5" /> : <Expand className="size-5" />}</Button>
        </div>

        <div className="absolute top-4 right-4 flex flex-col gap-2 z-[200]">
            <Button onClick={() => setIsFollowMode(!isFollowMode)} className={cn("h-10 w-10 border-2 shadow-xl", isFollowMode ? "bg-primary text-white" : "bg-white text-slate-400")}>
                {isFollowMode ? <Lock className="size-5" /> : <Unlock className="size-5" />}
            </Button>
            {!isFollowMode && (
                <Button onClick={() => { setIsFollowMode(true); googleMap?.panTo(logic.currentPos!); }} className="bg-white border-2 shadow-xl h-10 px-3 font-black text-[9px] uppercase text-primary gap-2">
                    <LocateFixed className="size-4" /> RE-CENTRER
                </Button>
            )}
        </div>
      </div>

      {/* PANNEAU DE CONTRÔLE PRINCIPAL */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-20">
          <div className="space-y-4">
              {logic.isSharing ? (
                  <div className="space-y-4 animate-in fade-in">
                      {/* STATUTS RAPIDES */}
                      <div className="grid grid-cols-2 gap-2">
                          <Button variant="outline" className="h-14 font-black uppercase text-[10px] border-2 bg-indigo-50 text-indigo-700" onClick={() => logic.setVesselStatus('returning')}>
                              <Navigation className="size-4 mr-2" /> Retour Maison
                          </Button>
                          <Button variant="outline" className="h-14 font-black uppercase text-[10px] border-2 bg-green-50 text-green-700" onClick={() => logic.setVesselStatus('landed')}>
                              <Home className="size-4 mr-2" /> Home (À terre)
                          </Button>
                      </div>

                      {/* URGENCES */}
                      <div className="grid grid-cols-3 gap-2">
                          <Button variant="destructive" className="h-14 font-black uppercase text-[10px] shadow-lg" onClick={() => ui.sendEmergencySms('MAYDAY', logic.profile?.emergencyContact || '', logic.currentPos?.lat || 0, logic.currentPos?.lng || 0)}>MAYDAY</Button>
                          <Button variant="secondary" className="h-14 font-black uppercase text-[10px] border-2 border-orange-200 text-orange-700" onClick={() => ui.sendEmergencySms('PANPAN', logic.profile?.emergencyContact || '', logic.currentPos?.lat || 0, logic.currentPos?.lng || 0)}>PANPAN</Button>
                          <Button variant="outline" className="h-14 font-black uppercase text-[10px] border-2 bg-red-50 text-red-600 animate-pulse" onClick={() => logic.setVesselStatus('emergency')}>ASSISTANCE</Button>
                      </div>

                      {/* TACTIQUE */}
                      <div className="grid grid-cols-4 gap-2">
                          <Button variant="outline" className="h-12 flex-col gap-1 font-black text-[8px] bg-slate-50 border-2" onClick={() => ui.addTacticalLog('OISEAUX', logic.currentPos?.lat || 0, logic.currentPos?.lng || 0)}><Bird className="size-4" /> OISEAUX</Button>
                          <Button variant="outline" className="h-12 flex-col gap-1 font-black text-[8px] bg-red-50 border-2 border-red-100" onClick={() => ui.addTacticalLog('THON', logic.currentPos?.lat || 0, logic.currentPos?.lng || 0)}><Target className="size-4 text-red-600" /> THON</Button>
                          <Button variant="outline" className="h-12 flex-col gap-1 font-black text-[8px] bg-emerald-50 border-2 border-emerald-100" onClick={() => ui.addTacticalLog('TAZARD', logic.currentPos?.lat || 0, logic.currentPos?.lng || 0)}><Fish className="size-4 text-emerald-600" /> TAZARD</Button>
                          <Button variant="secondary" className="h-12 flex-col gap-1 font-black text-[8px] border-2" onClick={() => photoInputRef.current?.click()}><Camera className="size-4" /> PRISE</Button>
                          <input type="file" accept="image/*" capture="environment" className="hidden" ref={photoInputRef} onChange={e => {
                              const file = e.target.files?.[0];
                              if (file) {
                                  const reader = new FileReader();
                                  reader.onload = (ev) => ui.addTacticalLog('PHOTO', logic.currentPos?.lat || 0, logic.currentPos?.lng || 0, ev.target?.result as string);
                                  reader.readAsDataURL(file);
                              }
                          }} />
                      </div>

                      <Button variant="destructive" className="w-full h-16 font-black uppercase tracking-widest shadow-xl rounded-2xl" onClick={logic.stopTracking}>
                          <X className="size-5 mr-2" /> Arrêter le partage
                      </Button>
                  </div>
              ) : (
                  <Card className="border-2 shadow-lg rounded-2xl overflow-hidden bg-white">
                      <CardHeader className="bg-primary/5 p-4 border-b">
                          <CardTitle className="text-xs font-black uppercase flex items-center gap-2"><Smartphone className="size-4" /> Identité & Partage</CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 space-y-4">
                          <div className="space-y-1.5">
                              <Label className="text-[10px] font-black uppercase opacity-60">Surnom du Navire</Label>
                              <Input value={logic.vesselNickname} onChange={e => logic.setVesselNickname(e.target.value)} placeholder="EX: BLACK PEARL" className="h-11 border-2 font-black uppercase" />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1.5">
                                  <Label className="text-[10px] font-black uppercase opacity-60">ID Navire (A)</Label>
                                  <Input value={logic.customSharingId} onChange={e => logic.setCustomSharingId(e.target.value)} placeholder="ID UNIQUE" className="h-11 border-2 font-black uppercase" />
                              </div>
                              <div className="space-y-1.5">
                                  <Label className="text-[10px] font-black uppercase opacity-60">ID Flotte (C)</Label>
                                  <Input value={logic.customFleetId} onChange={e => logic.setCustomFleetId(e.target.value)} placeholder="GROUPE" className="h-11 border-2 font-black uppercase" />
                              </div>
                          </div>
                          
                          {/* HISTORIQUE DES IDS */}
                          {logic.profile?.vesselIdHistory && logic.profile.vesselIdHistory.length > 0 && (
                              <div className="p-3 bg-muted/20 rounded-xl border-2 border-dashed space-y-2">
                                  <p className="text-[8px] font-black uppercase text-muted-foreground ml-1">Reconnexion rapide</p>
                                  <div className="flex flex-wrap gap-1.5">
                                      {logic.profile.vesselIdHistory.slice(-5).map(id => (
                                          <Badge key={id} variant="outline" className="bg-white text-[8px] font-black uppercase cursor-pointer hover:bg-primary/10" onClick={() => logic.setCustomSharingId(id)}>{id}</Badge>
                                      ))}
                                  </div>
                              </div>
                          )}

                          <Button className="w-full h-14 font-black uppercase tracking-widest shadow-xl rounded-xl" onClick={() => { ui.initAudio(); logic.startTracking(); }}>Lancer le Partage GPS</Button>
                      </CardContent>
                  </Card>
              )}
          </div>

          {/* JOURNAL DE BORD (BOÎTE NOIRE) */}
          <Card className="border-2 shadow-lg rounded-2xl overflow-hidden flex flex-col h-full bg-white">
              <Tabs defaultValue="tactical" className="flex flex-col h-full">
                  <TabsList className="grid grid-cols-2 h-12 rounded-none bg-muted/30 border-b p-1">
                      <TabsTrigger value="tactical" className="font-black uppercase text-[10px] gap-2"><MapPin className="size-3"/> Tactique</TabsTrigger>
                      <TabsTrigger value="tech" className="font-black uppercase text-[10px] gap-2"><Settings className="size-3"/> Technique</TabsTrigger>
                  </TabsList>
                  <TabsContent value="tactical" className="flex-1 p-0 m-0">
                      <ScrollArea className="h-[280px]">
                          <div className="p-3 space-y-2">
                              {ui.tacticalLogs && ui.tacticalLogs.length > 0 ? ui.tacticalLogs.map((log: any, i: number) => (
                                  <div key={i} onClick={() => googleMap?.panTo({ lat: log.lat, lng: log.lng })} className="p-3 bg-white border-2 rounded-xl flex items-center justify-between cursor-pointer active:scale-95 transition-all shadow-sm">
                                      <div className="flex items-center gap-3">
                                          {log.photoUrl ? (
                                              <div className="size-10 rounded-lg border overflow-hidden"><img src={log.photoUrl} className="size-full object-cover" alt=""/></div>
                                          ) : (
                                              <div className="p-2 bg-muted rounded-lg"><Fish className="size-4 opacity-40 text-primary"/></div>
                                          )}
                                          <div className="flex flex-col">
                                              <span className="font-black text-xs uppercase text-primary">{log.type}</span>
                                              <span className="text-[8px] font-bold opacity-40 uppercase">{log.time ? format(log.time.toDate(), 'HH:mm:ss') : '...'}</span>
                                          </div>
                                      </div>
                                      <div className="text-right">
                                          <p className="text-[9px] font-black uppercase text-blue-600">{log.wind} ND</p>
                                          <p className="text-[9px] font-black uppercase text-orange-600">{log.temp}°C</p>
                                      </div>
                                  </div>
                              )) : (
                                  <div className="p-12 text-center border-2 border-dashed rounded-2xl opacity-20"><History className="size-8 mx-auto mb-2"/><p className="text-[10px] font-black uppercase">Aucune prise enregistrée</p></div>
                              )}
                          </div>
                      </ScrollArea>
                  </TabsContent>
                  <TabsContent value="tech" className="flex-1 p-0 m-0">
                      <ScrollArea className="h-[280px]">
                          <div className="p-3 space-y-2">
                              <div className="flex justify-center mb-2">
                                  <Button variant="ghost" size="sm" className="h-7 text-[8px] font-black uppercase text-destructive border border-destructive/20" onClick={() => logic.setBreadcrumbs([])}>Effacer la trace (30 min)</Button>
                              </div>
                              {ui.techLogs?.map((log: any, i: number) => (
                                  <div key={i} className="p-3 bg-slate-50 border-2 rounded-xl flex items-center justify-between">
                                      <div className="flex flex-col">
                                          <span className="font-black text-[10px] uppercase text-slate-800">{log.status}</span>
                                          <span className="text-[8px] font-bold opacity-40 uppercase mt-1">{log.time ? format(log.time.toDate(), 'dd/MM HH:mm:ss') : '...'}</span>
                                      </div>
                                      <div className="flex items-center gap-3">
                                          <div className="text-right">
                                              <div className="flex items-center gap-1 text-[9px] font-black text-slate-500 justify-end"><Battery className="size-2.5"/> {log.battery}%</div>
                                              <div className="text-[8px] font-bold text-slate-400">+/- {log.accuracy}m</div>
                                          </div>
                                      </div>
                                  </div>
                              ))}
                          </div>
                      </ScrollArea>
                  </TabsContent>
              </Tabs>
          </Card>
      </div>

      {/* RÉGLAGES SONS & VEILLE */}
      <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="settings" className="border-none">
              <AccordionTrigger className="h-12 bg-muted/30 px-4 rounded-xl border-2 hover:no-underline">
                  <div className="flex items-center gap-2 font-black uppercase text-[10px]"><Settings className="size-4" /> Sons & Surveillance de Dérive</div>
              </AccordionTrigger>
              <AccordionContent className="pt-4 space-y-4">
                  <Card className="border-2 p-4 space-y-6 bg-white shadow-inner rounded-2xl">
                      <div className="space-y-3">
                          <div className="flex justify-between items-center px-1">
                              <Label className="text-[10px] font-black uppercase opacity-60">Volume des alertes</Label>
                              <span className="text-[10px] font-black">{Math.round(ui.vesselVolume * 100)}%</span>
                          </div>
                          <Slider value={[ui.vesselVolume * 100]} max={100} onValueChange={v => ui.setVesselVolume(v[0] / 100)} />
                      </div>

                      <div className="space-y-4 pt-2 border-t border-dashed">
                          <div className="flex justify-between items-center px-1">
                              <Label className="text-[10px] font-black uppercase opacity-60">Rayon de Mouillage</Label>
                              <Badge variant="outline" className="font-black">{logic.mooringRadius} mètres</Badge>
                          </div>
                          <Slider value={[logic.mooringRadius]} min={10} max={200} step={10} onValueChange={v => logic.setMooringRadius(v[0])} />
                          <p className="text-[8px] font-bold text-muted-foreground italic text-center">Déclenche l'alarme DÉRIVE si vous sortez de ce cercle.</p>
                      </div>

                      <div className="grid gap-3 pt-4 border-t border-dashed">
                          {Object.keys(ui.notifySettings).map(key => (
                              <div key={key} className="flex items-center justify-between p-2 hover:bg-muted/30 rounded-lg">
                                  <span className="text-[10px] font-bold uppercase">{key}</span>
                                  <div className="flex items-center gap-3">
                                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => ui.playSound(ui.notifySounds[key as keyof typeof ui.notifySounds])}><Play className="size-3" /></Button>
                                      <Switch 
                                        checked={ui.notifySettings[key as keyof typeof ui.notifySettings]} 
                                        onCheckedChange={v => ui.setNotifySettings({...ui.notifySettings, [key]: v})} 
                                      />
                                  </div>
                              </div>
                          ))}
                      </div>
                  </Card>
              </AccordionContent>
          </AccordionItem>
      </Accordion>

      <div className="space-y-2 relative z-10">
          <Card className="border-2 shadow-sm bg-muted/5">
              <CardHeader className="p-4 pb-2 border-b"><CardTitle className="text-[10px] font-black uppercase flex items-center gap-2"><Phone className="size-3" /> Annuaire Maritime NC</CardTitle></CardHeader>
              <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div className="space-y-2"><p className="text-[9px] font-black uppercase text-red-600 border-b pb-1">Urgences</p><p className="text-xs font-black">COSS Mer : 16</p><p className="text-xs font-black">SAMU Terre : 15</p></div>
                  <div className="space-y-2"><p className="text-[9px] font-black uppercase text-blue-600 border-b pb-1">Services</p><p className="text-xs font-black">Météo Marine : 36 67 36</p></div>
                  <div className="space-y-2"><p className="text-[9px] font-black uppercase text-indigo-600 border-b pb-1">Ports</p><p className="text-xs font-black">VHF 12 / 16</p></div>
              </CardContent>
          </Card>
      </div>
    </div>
  );
}
