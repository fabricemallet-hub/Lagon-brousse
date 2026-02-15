'use client';

import React, { useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import type { SystemNotification } from '@/lib/types';
import { Info, AlertTriangle, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Composant de bannière d'alerte globale.
 * Affiche les notifications système actives sur toutes les pages.
 */
export function NotificationBanner() {
  const firestore = useFirestore();

  // On simplifie la requête pour éviter les erreurs d'index composite (where + orderBy sur champs différents)
  // On récupère les notifications par date et on filtre le statut 'isActive' côté client.
  const notificationsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, 'system_notifications'),
      orderBy('createdAt', 'desc')
    );
  }, [firestore]);

  const { data: rawNotifications, error } = useCollection<SystemNotification>(notificationsQuery);

  // Filtrage client pour garantir l'affichage immédiat sans configuration d'index manuelle
  const activeNotifications = useMemo(() => {
    if (!rawNotifications) return [];
    return rawNotifications.filter(n => n.isActive === true).slice(0, 3); // Max 3 alertes simultanées
  }, [rawNotifications]);

  if (error || activeNotifications.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 w-full animate-in fade-in slide-in-from-top-4 duration-500">
      {activeNotifications.map((notif) => (
        <BannerItem key={notif.id} notification={notif} />
      ))}
    </div>
  );
}

function BannerItem({ notification }: { notification: SystemNotification }) {
  const [isVisible, setIsVisible] = React.useState(true);

  if (!isVisible) return null;

  const config = {
    info: {
      bg: 'bg-blue-50 border-blue-200',
      text: 'text-blue-800',
      icon: <Info className="size-5 text-blue-600 shrink-0" />,
    },
    warning: {
      bg: 'bg-amber-50 border-amber-200',
      text: 'text-amber-800',
      icon: <AlertTriangle className="size-5 text-amber-600 shrink-0" />,
    },
    error: {
      bg: 'bg-red-50 border-red-200',
      text: 'text-red-800',
      icon: <AlertCircle className="size-5 text-red-600 shrink-0" />,
    },
    success: {
      bg: 'bg-green-50 border-green-200',
      text: 'text-green-800',
      icon: <CheckCircle2 className="size-5 text-green-600 shrink-0" />,
    },
  }[notification.type] || {
    bg: 'bg-blue-50 border-blue-200',
    text: 'text-blue-800',
    icon: <Info className="size-5 text-blue-600 shrink-0" />,
  };

  return (
    <div className={cn(
      "relative w-full border-2 rounded-xl p-4 flex gap-4 shadow-sm overflow-hidden",
      config.bg,
      config.text
    )}>
      {config.icon}
      <div className="flex-grow space-y-1 pr-6">
        <h4 className="font-black uppercase tracking-tighter text-sm leading-none flex items-center gap-2">
          {notification.title}
        </h4>
        <p className="text-xs font-medium leading-relaxed opacity-90">
          {notification.content}
        </p>
      </div>
      <button 
        onClick={() => setIsVisible(false)}
        className="absolute top-2 right-2 p-1 hover:bg-black/5 rounded-full transition-colors"
      >
        <X className="size-4 opacity-40" />
      </button>
    </div>
  );
}
