'use client';

import React, { useState, useRef } from 'react';
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
import { 
  Navigation, Anchor, LocateFixed, ShieldAlert, Expand, Shrink, Zap, AlertTriangle,
  BatteryFull, History, MapPin, X, Play, RefreshCw, Home, Settings, Smartphone, 
  Bird, Target, Fish, Camera, Ghost, Users, Phone, Waves, Lock, Unlock, Save
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function VesselTrackerPage() {
  const [appMode, setAppMode] = useState<'sender' | 'receiver'>('sender');
  
  // 1. Initialisation des pôles
  const mapCore = useMapCore();
  const emetteur = useEmetteur(mapCore.updateBreadcrumbs);
  const recepteur = useRecepteur(emetteur.customSharingId);
  const flotte = useFlotte(emetteur.customSharingId, emetteur.vesselNickname);
  
  const photoInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="w-full space-y-4 pb-32 px-1">
      {/* SÉLECTEUR DE MODE GLOBAL */}
      <div className="flex bg-slate-900 text-white p-1 rounded-xl shadow-lg border-2 border-primary/20">
          <Button variant={appMode === 'sender' ? 'default' : 'ghost'} className="flex-1 font-black uppercase text-[10px] h-12" onClick={() => setAppMode('sender')}>Émetteur (A)</Button>
          <Button variant={appMode === 'receiver' ? 'default' : 'ghost'} className="flex-1 font-black uppercase text-[10px] h-12" onClick={() => setAppMode('receiver')}>Récepteur (B)</Button>
      </div>

      {/* SÉLECTEUR DE MODE CARTE */}
      <div className="flex bg-muted/30 p-1 rounded-xl border relative z-20">
          <Button variant={mapCore.viewMode === 'alpha' ? 'default' : 'ghost'} className="flex-1 font-black uppercase text-[10px] h-10" onClick={() => mapCore.setViewMode('alpha')}>Alpha</Button>
          <Button variant={mapCore.viewMode === 'beta' ? 'default' : 'ghost'} className="flex-1 font-black uppercase text-[10px] h-10" onClick={() => mapCore.setViewMode('beta')}>Béta</Button>
          <Button variant={mapCore.viewMode === 'gamma' ? 'default' : 'ghost'} className="flex-1 font-black uppercase text-[10px] h-10" onClick={() => mapCore.setViewMode('gamma')}>Gamma</Button>
      </div>

      {/* CONTENEUR CARTE */}
      <div className={cn("relative w-full rounded-[2.5rem] border-4 border-slate-900 shadow-2xl overflow-hidden bg-slate-100 transition-all", mapCore.isFullscreen ? "fixed inset-0 z-[150] h-screen" : "h-[500px]")}>
        {mapCore.isGoogleLoaded && (
            <GoogleMap
                mapContainerClassName="w-full h-full"
                defaultCenter={INITIAL_CENTER}
                defaultZoom={12}
                onLoad={mapCore.setGoogleMap}
                onDragStart={() => mapCore.setIsFollowMode(false)}
                options={{ disableDefaultUI: true, mapTypeId: 'hybrid', gestureHandling: 'greedy' }}
            >
                {/* POSITION RÉELLE (ÉMETTEUR) */}
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
                    <Polyline path={mapCore.breadcrumbs} options={{ strokeColor: "#3b82f6", strokeOpacity: 0.6, strokeWeight: 2 }} />
                )}

                {/* MOUILLAGE */}
                {emetteur.anchorPos && (
                    <>
                        <OverlayView position={emetteur.anchorPos} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                            <div style={{ transform: 'translate(-50%, -50%)' }} className="size-8 bg-orange-500 rounded-full border-2 border-white flex items-center justify-center shadow-lg"><Anchor className="size-4 text-white" /></div>
                        </OverlayView>
                        <Circle center={emetteur.anchorPos} radius={emetteur.mooringRadius} options={{ strokeColor: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.15, strokeWidth: 1 }} />
                    </>
                )}
            </GoogleMap>
        )}
        
        {/* BOUTONS FLOTTANTS */}
        <div className="absolute top-4 left-4 z-[200] flex flex-col gap-2">
            <Button size="icon" className="bg-white/90 border-2 h-10 w-10" onClick={() => mapCore.setIsFullscreen(!mapCore.isFullscreen)}>{mapCore.isFullscreen ? <Shrink /> : <Expand />}</Button>
        </div>
        <div className="absolute top-4 right-4 z-[200] flex flex-col gap-2">
            <Button onClick={() => mapCore.setIsFollowMode(!mapCore.isFollowMode)} className={cn("h-10 w-10 border-2", mapCore.isFollowMode ? "bg-primary text-white" : "bg-white")}>{mapCore.isFollowMode ? <Lock /> : <Unlock />}</Button>
            {!mapCore.isFollowMode && <Button onClick={() => mapCore.handleRecenter(emetteur.currentPos)} className="bg-white border-2 font-black text-[9px] uppercase gap-2 px-2 h-10"><LocateFixed className="size-4"/> RE-CENTRER</Button>}
        </div>
      </div>

      {/* PANNEAU DE CONTRÔLE SELON MODE */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {appMode === 'sender' ? (
              <div className="space-y-4">
                  {emetteur.isSharing ? (
                      <div className="space-y-4 animate-in fade-in">
                          <div className="grid grid-cols-2 gap-2">
                              <Button variant="outline" className="h-14 font-black uppercase text-[10px] border-2 bg-indigo-50 text-indigo-700" onClick={() => emetteur.setManualStatus('returning', 'RETOUR MAISON')}><Navigation className="size-4 mr-2" /> Retour Maison</Button>
                              <Button variant="outline" className="h-14 font-black uppercase text-[10px] border-2 bg-green-50 text-green-700" onClick={() => emetteur.setManualStatus('landed', 'À TERRE')}><Home className="size-4 mr-2" /> Home (À terre)</Button>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                              <Button variant="destructive" className="h-14 font-black text-[10px]" onClick={() => flotte.triggerEmergency('MAYDAY', emetteur.emergencyContact, emetteur.currentPos?.lat || 0, emetteur.currentPos?.lng || 0)}>MAYDAY</Button>
                              <Button variant="secondary" className="h-14 font-black text-[10px] border-2 border-orange-200" onClick={() => flotte.triggerEmergency('PANPAN', emetteur.emergencyContact, emetteur.currentPos?.lat || 0, emetteur.currentPos?.lng || 0)}>PANPAN</Button>
                              <Button variant="outline" className="h-14 font-black text-[10px] bg-red-50 text-red-600 animate-pulse border-2" onClick={() => emetteur.setManualStatus('emergency', 'ASSISTANCE')}>ASSISTANCE</Button>
                          </div>
                          <div className="grid grid-cols-4 gap-2">
                              <Button variant="outline" className="h-12 flex-col gap-1 font-black text-[8px]" onClick={() => flotte.addTacticalLog('THON', emetteur.currentPos?.lat || 0, emetteur.currentPos?.lng || 0)}><Target className="size-4 text-red-600"/> THON</Button>
                              <Button variant="outline" className="h-12 flex-col gap-1 font-black text-[8px]" onClick={() => flotte.addTacticalLog('TAZARD', emetteur.currentPos?.lat || 0, emetteur.currentPos?.lng || 0)}><Fish className="size-4 text-emerald-600"/> TAZARD</Button>
                              <Button variant="outline" className="h-12 flex-col gap-1 font-black text-[8px]" onClick={() => flotte.addTacticalLog('OISEAUX', emetteur.currentPos?.lat || 0, emetteur.currentPos?.lng || 0)}><Bird className="size-4"/> OISEAUX</Button>
                              <Button variant="secondary" className="h-12 flex-col gap-1 font-black text-[8px]" onClick={() => photoInputRef.current?.click()}><Camera className="size-4"/> PRISE</Button>
                          </div>
                          <input type="file" accept="image/*" capture="environment" ref={photoInputRef} className="hidden" onChange={e => {
                              const file = e.target.files?.[0];
                              if (file) {
                                  const reader = new FileReader();
                                  reader.onload = (ev) => flotte.addTacticalLog('PHOTO', emetteur.currentPos?.lat || 0, emetteur.currentPos?.lng || 0, ev.target?.result as string);
                                  reader.readAsDataURL(file);
                              }
                          }} />
                          <Button variant="destructive" className="w-full h-16 font-black uppercase tracking-widest shadow-xl rounded-2xl" onClick={emetteur.stopSharing}><X className="size-5 mr-2" /> Arrêter le partage</Button>
                      </div>
                  ) : (
                      <Card className="border-2 shadow-lg rounded-2xl overflow-hidden">
                          <CardHeader className="bg-primary/5 p-4 border-b"><CardTitle className="text-xs font-black uppercase">Identité & Partage</CardTitle></CardHeader>
                          <CardContent className="p-4 space-y-4">
                              <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase opacity-60">Surnom du Navire</Label><Input value={emetteur.vesselNickname} onChange={e => emetteur.setVesselNickname(e.target.value)} className="h-11 border-2 font-black uppercase" /></div>
                              <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase opacity-60">ID Navire (Partage)</Label><Input value={emetteur.customSharingId} onChange={e => emetteur.setCustomSharingId(e.target.value)} className="h-11 border-2 font-black uppercase text-center" /></div>
                              <Button className="w-full h-14 font-black uppercase tracking-widest shadow-xl" onClick={emetteur.startSharing}>Lancer le Partage GPS</Button>
                          </CardContent>
                      </Card>
                  )}
              </div>
          ) : (
              <div className="space-y-4">
                  <Card className="border-2 shadow-lg rounded-2xl overflow-hidden h-full flex flex-col">
                      <Tabs defaultValue="tactical" className="flex flex-col h-full">
                          <TabsList className="grid grid-cols-2 h-12 bg-muted/30 border-b">
                              <TabsTrigger value="tactical" className="font-black uppercase text-[10px]">Tactique</TabsTrigger>
                              <TabsTrigger value="tech" className="font-black uppercase text-[10px]">Technique</TabsTrigger>
                          </TabsList>
                          <TabsContent value="tactical" className="flex-1 p-0 m-0">
                              <ScrollArea className="h-[280px]">
                                  <div className="p-3 space-y-2">
                                      {flotte.tacticalLogs.length > 0 ? flotte.tacticalLogs.map((log, i) => (
                                          <div key={i} onClick={() => mapCore.handleRecenter({ lat: log.lat, lng: log.lng })} className="p-3 bg-white border-2 rounded-xl flex items-center justify-between cursor-pointer active:scale-95 shadow-sm">
                                              <div className="flex items-center gap-3">
                                                  {log.photoUrl ? <div className="size-10 rounded-lg border overflow-hidden"><img src={log.photoUrl} className="size-full object-cover" alt=""/></div> : <div className="p-2 bg-muted rounded-lg"><Fish className="size-4 opacity-40 text-primary"/></div>}
                                                  <div className="flex flex-col"><span className="font-black text-xs uppercase text-primary">{log.type}</span><span className="text-[8px] font-bold opacity-40">{log.time ? format(log.time.toDate(), 'HH:mm') : '...'}</span></div>
                                              </div>
                                              <div className="text-right"><p className="text-[9px] font-black text-blue-600">{log.wind} ND</p><p className="text-[9px] font-black text-orange-600">{log.temp}°C</p></div>
                                          </div>
                                      )) : <div className="p-12 text-center opacity-20"><HistoryIcon className="size-8 mx-auto mb-2"/><p className="text-[10px] font-black uppercase">Aucune prise</p></div>}
                                  </div>
                              </ScrollArea>
                          </TabsContent>
                          <TabsContent value="tech" className="flex-1 p-0 m-0">
                              <ScrollArea className="h-[280px]">
                                  <div className="p-3 space-y-2">
                                      <Button variant="ghost" size="sm" className="w-full h-8 text-[8px] font-black uppercase text-destructive border-2 border-dashed mb-2" onClick={mapCore.clearBreadcrumbs}>Effacer la trace (30 min)</Button>
                                      {recepteur.techLogs.map((log, i) => (
                                          <div key={i} className="p-3 bg-slate-50 border-2 rounded-xl flex items-center justify-between">
                                              <div className="flex flex-col"><span className="font-black text-[10px] uppercase">{log.status}</span><span className="text-[8px] font-bold opacity-40">{log.time ? format(log.time.toDate(), 'HH:mm:ss') : '...'}</span></div>
                                              <div className="text-right flex items-center gap-2"><Battery className="size-3 opacity-40"/> <span className="text-[9px] font-black">{log.batteryLevel}%</span></div>
                                          </div>
                                      ))}
                                  </div>
                              </ScrollArea>
                          </TabsContent>
                      </Tabs>
                  </Card>
              </div>
          )}
      </div>

      {/* ACCORDÉON RÉGLAGES */}
      <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="prefs" className="border-none">
              <AccordionTrigger className="h-12 bg-muted/30 px-4 rounded-xl border-2 hover:no-underline">
                  <div className="flex items-center gap-2 font-black uppercase text-[10px]"><Settings className="size-4" /> Sons & SMS d'urgence</div>
              </AccordionTrigger>
              <AccordionContent className="pt-4 space-y-4">
                  <Card className="border-2 p-4 space-y-6 bg-white rounded-2xl shadow-inner">
                      {/* AUDIO */}
                      <div className="space-y-4">
                          <div className="flex justify-between items-center"><Label className="text-[10px] font-black uppercase">Volume alertes</Label><span className="text-[10px] font-black">{Math.round(recepteur.vesselPrefs.volume * 100)}%</span></div>
                          <Slider value={[recepteur.vesselPrefs.volume * 100]} max={100} onValueChange={v => recepteur.savePrefs({ volume: v[0] / 100 })} />
                          <div className="grid gap-3 pt-2">
                              {Object.keys(recepteur.vesselPrefs.sounds).map(key => (
                                  <div key={key} className="flex items-center justify-between p-2 hover:bg-muted/30 rounded-lg">
                                      <span className="text-[10px] font-bold uppercase">{key}</span>
                                      <div className="flex items-center gap-3">
                                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => recepteur.playSound(recepteur.vesselPrefs.sounds[key as keyof typeof recepteur.vesselPrefs.sounds])}><Play className="size-3" /></Button>
                                          <Switch checked={recepteur.vesselPrefs.notifyEnabled} onCheckedChange={v => recepteur.savePrefs({ notifyEnabled: v })} />
                                      </div>
                                  </div>
                              ))}
                          </div>
                      </div>
                      
                      {/* MOUILLAGE */}
                      {appMode === 'sender' && (
                          <div className="space-y-4 pt-4 border-t border-dashed">
                              <div className="flex justify-between items-center"><Label className="text-[10px] font-black uppercase">Rayon Mouillage</Label><Badge variant="outline" className="font-black">{emetteur.mooringRadius}m</Badge></div>
                              <Slider value={[emetteur.mooringRadius]} min={10} max={200} step={10} onValueChange={v => emetteur.setMooringRadius(v[0])} />
                          </div>
                      )}

                      {/* SMS */}
                      <div className="space-y-4 pt-4 border-t border-dashed">
                          <Label className="text-[10px] font-black uppercase">Contact d'urgence (SMS)</Label>
                          <Input value={emetteur.emergencyContact} onChange={e => emetteur.saveSmsSettings(e.target.value, emetteur.vesselSmsMessage)} placeholder="Numéro..." className="h-10 border-2 font-black" />
                          <Textarea value={emetteur.vesselSmsMessage} onChange={e => emetteur.saveSmsSettings(emetteur.emergencyContact, e.target.value)} placeholder="Message..." className="border-2 font-medium" />
                      </div>
                  </Card>
              </AccordionContent>
          </AccordionItem>
      </Accordion>

      <Card className="border-2 shadow-sm bg-muted/5">
          <CardHeader className="p-4 pb-2 border-b"><CardTitle className="text-[10px] font-black uppercase flex items-center gap-2"><Phone className="size-3" /> Annuaire Maritime NC</CardTitle></CardHeader>
          <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="space-y-2"><p className="text-[9px] font-black uppercase text-red-600 border-b pb-1">Urgences</p><p className="text-xs font-black">COSS Mer : 16</p><p className="text-xs font-black">SAMU Terre : 15</p></div>
              <div className="space-y-2"><p className="text-[9px] font-black uppercase text-blue-600 border-b pb-1">Services</p><p className="text-xs font-black">Météo Marine : 36 67 36</p></div>
              <div className="space-y-2"><p className="text-[9px] font-black uppercase text-indigo-600 border-b pb-1">Ports</p><p className="text-xs font-black">VHF 12 / 16</p></div>
          </CardContent>
      </Card>
    </div>
  );
}

const INITIAL_CENTER = { lat: -21.3, lng: 165.5 };
