
'use client';

import { useEffect, useState } from 'react';
import { useUser, useFirestore, useFirebaseApp } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { useToast } from '@/hooks/use-toast';
import { Bell, BellOff, ShieldCheck } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';

export function PushNotificationManager() {
  const { user } = useUser();
  const firestore = useFirestore();
  const firebaseApp = useFirebaseApp();
  const { toast } = useToast();
  const [permission, setPermission] = useState<NotificationPermission | 'default'>('default');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  // Écouteur de messages au premier plan
  useEffect(() => {
    if (!firebaseApp || typeof window === 'undefined') return;

    const messaging = getMessaging(firebaseApp);
    const unsubscribe = onMessage(messaging, (payload) => {
      console.log('Message reçu au premier plan:', payload);
      toast({
        title: payload.notification?.title || 'Notification',
        description: payload.notification?.body || '',
      });
      
      // Optionnel : jouer un son personnalisé si l'app est ouverte
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3');
      audio.play().catch(() => {});
    });

    return () => unsubscribe();
  }, [firebaseApp, toast]);

  const requestPermission = async () => {
    if (!user || !firestore || !firebaseApp) return;
    
    setIsLoading(true);
    try {
      const status = await Notification.requestPermission();
      setPermission(status);

      if (status === 'granted') {
        const messaging = getMessaging(firebaseApp);
        // Remplacez par votre clé VAPID publique générée dans la console Firebase
        const token = await getToken(messaging, {
          vapidKey: 'BDS_VOTRE_CLE_VAPID_GENEREE_DANS_CONSOLE_FIREBASE' 
        });

        if (token) {
          await updateDoc(doc(firestore, 'users', user.uid), {
            fcmToken: token,
            notificationsEnabled: true
          });
          toast({
            title: "Notifications activées",
            description: "Vous recevrez désormais les alertes même en veille.",
          });
        }
      }
    } catch (error) {
      console.error("Erreur permission notifications:", error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible d'activer les notifications.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (permission === 'granted') return null;

  return (
    <Card className="border-2 border-primary/20 bg-primary/5 mb-6">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-sm font-black uppercase flex items-center gap-2">
          <Bell className="size-4 text-primary" /> Notifications Push
        </CardTitle>
        <CardDescription className="text-[10px]">
          Recevez les alertes de sécurité et de chasse en temps réel.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-3">
        {permission === 'denied' ? (
          <Alert variant="destructive" className="py-2">
            <BellOff className="size-4" />
            <AlertTitle className="text-[10px] font-bold uppercase">Accès bloqué</AlertTitle>
            <AlertDescription className="text-[9px]">
              Veuillez autoriser les notifications dans les réglages de votre navigateur.
            </AlertDescription>
          </Alert>
        ) : (
          <Button 
            onClick={requestPermission} 
            disabled={isLoading}
            className="w-full h-10 font-black uppercase text-[10px] tracking-widest"
          >
            {isLoading ? "Activation..." : "Activer les alertes"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
