
'use client';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Button } from './ui/button';
import { Avatar, AvatarFallback } from './ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { AppLogo } from './icons';
import { SidebarNav } from './sidebar-nav';
import {
  LogOut,
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  User,
  AlertCircle,
  Fish,
  Leaf,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useLocation } from '@/context/location-context';
import { usePathname, useRouter } from 'next/navigation';
import { useDate } from '@/context/date-context';
import { useCalendarView } from '@/context/calendar-view-context';
import { Popover, PopoverTrigger, PopoverContent } from './ui/popover';
import { Calendar } from './ui/calendar';
import { format, addDays, subDays, isBefore } from 'date-fns';
import { fr } from 'date-fns/locale';
import Link from 'next/link';
import { useUser, useAuth, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { Skeleton } from './ui/skeleton';
import { signOut } from 'firebase/auth';
import { doc } from 'firebase/firestore';
import type { UserAccount } from '@/lib/types';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from './ui/badge';
import { cn } from '@/lib/utils';
import { BottomNav } from './bottom-nav';

const USAGE_LIMIT_SECONDS = 60;

const UsageTimer = React.memo(({ status, auth }: { status: string, auth: any }) => {
  const [timeLeft, setTimeLeft] = useState(USAGE_LIMIT_SECONDS);
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status !== 'limited' || !auth) return;

    const today = new Date().toISOString().split('T')[0];
    const lastUsageDate = localStorage.getItem('lastUsageDate');
    let dailyUsage = parseInt(localStorage.getItem('dailyUsage') || '0', 10);

    if (lastUsageDate !== today) {
      dailyUsage = 0;
      localStorage.setItem('lastUsageDate', today);
    }
    
    const remaining = Math.max(0, USAGE_LIMIT_SECONDS - dailyUsage);
    setTimeLeft(remaining);

    if (remaining > 0) {
      const interval = setInterval(() => {
        setTimeLeft(prev => {
          const next = prev - 1;
          if (next % 5 === 0 || next <= 0) {
            localStorage.setItem('dailyUsage', String(USAGE_LIMIT_SECONDS - next));
          }
          if (next <= 0) {
            clearInterval(interval);
            toast({ variant: 'destructive', title: 'Limite atteinte', description: 'Déconnexion...' });
            signOut(auth).then(() => {
              sessionStorage.clear();
              if (pathname !== '/login') router.push('/login');
            });
          }
          return next;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [status, auth, toast, router, pathname]);

  if (status !== 'limited') return null;

  return (
    <div className="fixed top-0 left-0 right-0 h-10 bg-destructive/90 text-destructive-foreground flex items-center justify-center text-sm font-bold z-50 shadow-md">
        <AlertCircle className="size-4 mr-2" />
        Mode Limité : {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')} restant.
    </div>
  );
});
UsageTimer.displayName = 'UsageTimer';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { locations, selectedLocation, setSelectedLocation, isLocationLoading } = useLocation();
  const { selectedDate, setSelectedDate } = useDate();
  const { calendarView, setCalendarView } = useCalendarView();
  const pathname = usePathname();
  const router = useRouter();
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const [isDatePickerOpen, setDatePickerOpen] = useState(false);

  const userDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);

  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserAccount>(userDocRef);

  const status = useMemo(() => {
    if (isUserLoading || (user && isProfileLoading)) return 'loading';
    if (!user) return 'limited';
    if (!userProfile) return 'loading';

    switch (userProfile.subscriptionStatus) {
      case 'admin': return 'admin';
      case 'active':
        return isBefore(new Date(), new Date(userProfile.subscriptionExpiryDate!)) ? 'active' : 'limited';
      case 'trial':
        return isBefore(new Date(), new Date(userProfile.subscriptionExpiryDate!)) ? 'trial' : 'limited';
      default: return 'limited';
    }
  }, [user, isUserLoading, userProfile, isProfileLoading]);

  const isAuthPage = pathname === '/login' || pathname === '/signup';

  const handleLogout = useCallback(async () => { 
    if (auth) { 
      await signOut(auth); 
      sessionStorage.clear(); 
      router.push('/login'); 
    } 
  }, [auth, router]);

  const handlePrevDay = useCallback(() => setSelectedDate(subDays(selectedDate, 1)), [selectedDate, setSelectedDate]);
  const handleNextDay = useCallback(() => setSelectedDate(addDays(selectedDate, 1)), [selectedDate, setSelectedDate]);

  if (isAuthPage) return <>{children}</>;

  const showDayNavigator = ['/', '/lagon', '/peche', '/champs', '/chasse', '/calendrier'].includes(pathname);

  return (
    <div>
      <SidebarProvider>
        <Sidebar>
          <SidebarHeader><div className="flex items-center gap-3 p-2"><AppLogo className="size-8 text-primary" /><h1 className="font-bold text-lg group-data-[collapsible=icon]:hidden">Lagon & Brousse</h1></div></SidebarHeader>
          <SidebarContent><SidebarNav /></SidebarContent>
          <SidebarFooter>
            {isUserLoading || (user && isProfileLoading) ? (
              <div className="flex items-center gap-3 p-2"><Skeleton className="h-8 w-8 rounded-full" /><div className="flex flex-col gap-1"><Skeleton className="h-4 w-20" /></div></div>
            ) : user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="w-full justify-start h-12 p-2 gap-3">
                    <Avatar className="h-8 w-8"><AvatarFallback>{user.email?.[0].toUpperCase()}</AvatarFallback></Avatar>
                    <div className="text-left group-data-[collapsible=icon]:hidden"><p className="font-medium text-xs truncate w-32">{user.email}</p></div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem asChild><Link href="/compte" className="flex items-center"><User className="mr-2 h-4 w-4" />Compte</Link></DropdownMenuItem>
                  <DropdownMenuItem onClick={handleLogout}><LogOut className="mr-2 h-4 w-4" />Déconnexion</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button asChild variant="ghost" className="w-full justify-start h-12"><Link href="/login"><LogOut className="mr-2" />Connexion</Link></Button>
            )}
          </SidebarFooter>
        </Sidebar>
        <main className="flex-1 flex flex-col min-h-screen">
          <UsageTimer status={status} auth={auth} />
          <header className={cn("flex h-auto min-h-14 items-center gap-4 border-b bg-card px-4 lg:h-[60px] lg:px-6 sticky top-0 z-30 py-2", status === 'limited' && 'mt-10')}>
            <SidebarTrigger />
            <div className="w-full flex-1 flex items-center justify-between flex-wrap gap-y-2">
              <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
                {status === 'trial' && <Badge variant="secondary">Essai</Badge>}
                {status === 'limited' && <Badge variant="destructive">Limité</Badge>}
                {isLocationLoading ? <Skeleton className="h-10 w-[180px]" /> : (
                  <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                    <SelectTrigger className="w-[150px] sm:w-[180px]"><SelectValue placeholder="Commune" /></SelectTrigger>
                    <SelectContent>{locations.map((loc) => <SelectItem key={loc} value={loc}>{loc}</SelectItem>)}</SelectContent>
                  </Select>
                )}
                {showDayNavigator && (
                  <div className="flex items-center gap-1 rounded-md border bg-background p-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handlePrevDay}><ChevronLeft className="h-4 w-4" /></Button>
                    <Popover open={isDatePickerOpen} onOpenChange={setDatePickerOpen}>
                      <PopoverTrigger asChild>
                        <Button variant={'outline'} className="w-[150px] sm:w-[180px] justify-start text-left font-normal h-8">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {format(selectedDate, 'PPP', { locale: fr })}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={selectedDate} onSelect={(d) => { if(d) { setSelectedDate(d); setDatePickerOpen(false); } }} initialFocus /></PopoverContent>
                    </Popover>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleNextDay}><ChevronRight className="h-4 w-4" /></Button>
                  </div>
                )}
              </div>

              {pathname === '/calendrier' && (
                <div className="flex items-center gap-1 bg-muted p-1 rounded-lg h-9">
                  <Button 
                    variant={calendarView === 'peche' ? 'secondary' : 'ghost'} 
                    size="sm" 
                    className={cn("h-7 px-3 text-xs font-bold", calendarView === 'peche' && "bg-background shadow-sm")}
                    onClick={() => setCalendarView('peche')}
                  >
                    <Fish className="mr-2 size-3" /> Pêche
                  </Button>
                  <Button 
                    variant={calendarView === 'champs' ? 'secondary' : 'ghost'} 
                    size="sm" 
                    className={cn("h-7 px-3 text-xs font-bold", calendarView === 'champs' && "bg-background shadow-sm")}
                    onClick={() => setCalendarView('champs')}
                  >
                    <Leaf className="mr-2 size-3" /> Champs
                  </Button>
                </div>
              )}
            </div>
          </header>
          <div className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6 pb-36 md:pb-12">{children}</div>
          <BottomNav />
        </main>
      </SidebarProvider>
    </div>
  );
}
