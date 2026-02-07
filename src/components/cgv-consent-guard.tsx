
'use client';

import { useState, useEffect } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, collection, addDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import type { UserAccount, CgvSettings } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { ShieldCheck, RefreshCw, ScrollText, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function CgvConsentGuard({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [showGuard, setShowGuard] = useState(false);
  const [isAccepted, setIsAccepted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const userDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserAccount>(userDocRef);

  const cgvRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'app_settings', 'cgv');
  }, [firestore]);
  const { data: cgvData, isLoading: isCgvLoading } = useDoc<CgvSettings>(cgvRef);

  useEffect(() => {
    if (!isUserLoading && !isProfileLoading && !isCgvLoading && userProfile && cgvData) {
      const userVersion = userProfile.cgvVersionSeen || 0;
      const currentVersion = cgvData.version || 0;

      if (userVersion < currentVersion) {
        setShowGuard(true);
      } else {
        setShowGuard(false);
      }
    }
  }, [isUserLoading, isProfileLoading, isCgvLoading, userProfile, cgvData]);

  const handleAcceptUpdate = async () => {
    if (!user || !firestore || !cgvData || !isAccepted) return;
    setIsSaving(true);
    try {
      // 1. Record acceptance in audit log
      const acceptanceRef = collection(firestore, 'users', user.uid, 'cgv_acceptances');
      await addDoc(acceptanceRef, {
        userId: user.uid,
        acceptedAt: serverTimestamp(),
        version: cgvData.version,
        content: cgvData.content,
        type: 'update_validation'
      });

      // 2. Update user profile
      await updateDoc(doc(firestore, 'users', user.uid), {
        cgvAcceptedAt: new Date().toISOString(),
        cgvVersionSeen: cgvData.version
      });

      toast({ title: "CGV Validées", description: "Merci pour votre confiance." });
      setShowGuard(false);
    } catch (e) {
      toast({ variant: 'destructive', title: "Erreur", description: "Impossible d'enregistrer la validation." });
    } finally {
      setIsSaving(false);
    }
  };

  if (!showGuard) return <>{children}</>;

  return (
    <>
      {/* On affiche quand même les enfants mais avec un overlay bloquant si nécessaire */}
      {children}
      
      <Dialog open={showGuard} onOpenChange={() => {}}>
        <DialogContent className="max-w-xl max-h-[90vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl z-[200]" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader className="p-6 bg-amber-50 border-b border-amber-100 shrink-0">
            <DialogTitle className="flex items-center gap-3 font-black uppercase tracking-tighter text-amber-900">
              <ShieldCheck className="size-6 text-amber-600" /> Mise à jour légale
            </DialogTitle>
            <DialogDescription className="text-xs font-bold text-amber-800 uppercase mt-1">
              Nos conditions générales de vente ont été modifiées.
            </DialogDescription>
          </DialogHeader>

          <div className="p-4 bg-muted/30 border-b shrink-0 flex items-start gap-3">
            <AlertTriangle className="size-5 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[10px] font-medium leading-relaxed">
              Pour continuer à utiliser **Lagon & Brousse NC**, vous devez prendre connaissance des nouvelles conditions et les accepter. Une copie de ce document sera conservée sur votre profil.
            </p>
          </div>

          <ScrollArea className="flex-1 p-6 bg-white">
            <div className="prose prose-sm font-medium leading-relaxed text-muted-foreground whitespace-pre-wrap">
              <div className="flex items-center gap-2 mb-4 text-xs font-black uppercase text-slate-400 border-b pb-2">
                <ScrollText className="size-3" /> Version du document : {cgvData?.version || 'N/A'}
              </div>
              {cgvData?.content || "Chargement des conditions..."}
            </div>
          </ScrollArea>

          <DialogFooter className="p-6 bg-slate-50 border-t flex flex-col gap-4 shrink-0">
            <div className="flex items-start space-x-3">
              <Checkbox 
                id="accept-update" 
                checked={isAccepted} 
                onCheckedChange={(v) => setIsAccepted(!!v)} 
                className="mt-1 border-2 border-primary"
              />
              <label htmlFor="accept-update" className="text-xs font-bold leading-tight cursor-pointer">
                Je certifie avoir lu et j'accepte les nouvelles Conditions Générales de Vente de l'application.
              </label>
            </div>
            
            <Button 
              onClick={handleAcceptUpdate} 
              disabled={!isAccepted || isSaving} 
              className="w-full h-14 font-black uppercase tracking-widest shadow-lg gap-2"
            >
              {isSaving ? <RefreshCw className="size-5 animate-spin" /> : <ShieldCheck className="size-5" />}
              {isSaving ? "Traitement..." : "Valider et continuer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
