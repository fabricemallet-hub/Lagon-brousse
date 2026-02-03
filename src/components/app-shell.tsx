'use client';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
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

const UsageTimer = React.memo(({ status, auth, userId }: { status: string, auth: any, userId?: string }) => {
  const [timeLeft, setTimeLeft] = useState(USAGE_LIMIT_SECONDS);
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Reset timer state when status changes to trial/limited or user changes
    if ((status !== 'limited' && status !== 'trial') || !auth || !userId) {
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    const lastUsageDate = localStorage.getItem('lastUsageDate');
    const lastUserId = localStorage.getItem('lastUserId');
    let dailyUsage = parseInt(localStorage.getItem('dailyUsage') || '0', 10);

    // Reset si nouveau jour OU changement d'utilisateur
    if (lastUsageDate !== today || lastUserId !== userId) {
      dailyUsage = 0;
      localStorage.setItem('lastUsageDate', today);
      localStorage.setItem('lastUserId', userId || '');
      localStorage.setItem('dailyUsage', '0');
    }
    
    const initialRemaining = Math.max(0, USAGE_LIMIT_SECONDS - dailyUsage);
    setTimeLeft(initialRemaining);

    if (initialRemaining <= 0) {
        toast({ variant: 'destructive', title: 'Limite atteinte', description: 'Votre minute quotidienne est épuisée.' });
        signOut(auth).then(() => {
            sessionStorage.clear();
            if (pathname !== '/login') router.push('/login');
        });
        return;
    }

    const interval = setInterval(() => {
      setTimeLeft(prev => {
        const next = Math.max(0, prev - 1);
        const used = USAGE_LIMIT_SECONDS - next;
        
        localStorage.setItem('dailyUsage', String(used));
        
        if (next <= 0) {
          clearInterval(interval);
          toast({ variant: 'destructive', title: 'Limite atteinte', description: 'Déconnexion automatique...' });
          signOut(auth).then(() => {
            sessionStorage.clear();
            if (pathname !== '/login') router.push('/login');
          });
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [status, auth, userId, toast, router, pathname]);

  if (status !== 'limited' && status !== 'trial') return null;

  return (
    <div className="fixed top-0 left-0 right-0 h-10 bg-red-600 text-white flex items-center justify-center text-xs font-black z-[100] shadow-xl px-4 text-center border-b border-white/20">
        <AlertCircle className="size-4 mr-2 shrink-0" />
        {status === 'trial' ? 'Session d\'essai' : 'Mode Limité'} : {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')} restant
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
    if (!userProfile) return 'limited';

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

  if (isAuthPage) return <div className="w-full min-h-screen">{children}</div>;

  const showDayNavigator = ['/', '/lagon', '/peche', '/champs', '/chasse', '/calendrier'].includes(pathname);

  return (
    <div className="w-full">
      <SidebarProvider defaultOpen={false}>
        <InnerAppShell 
          status={status} 
          user={user} 
          isUserLoading={isUserLoading}
          isProfileLoading={isProfileLoading}
          selectedLocation={selectedLocation}
          setSelectedLocation={setSelectedLocation}
          isLocationLoading={isLocationLoading}
          locations={locations}
          showDayNavigator={showDayNavigator}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          isDatePickerOpen={isDatePickerOpen}
          setDatePickerOpen={setDatePickerOpen}
          handlePrevDay={handlePrevDay}
          handleNextDay={handleNextDay}
          pathname={pathname}
          calendarView={calendarView}
          setCalendarView={setCalendarView}
          handleLogout={handleLogout}
          auth={auth}
        >
          {children}
        </InnerAppShell>
      </SidebarProvider>
    </div>
  );
}

function InnerAppShell({ 
  children, 
  status, 
  user, 
  isUserLoading, 
  isProfileLoading,
  selectedLocation,
  setSelectedLocation,
  isLocationLoading,
  locations,
  showDayNavigator,
  selectedDate,
  setSelectedDate,
  isDatePickerOpen,
  setDatePickerOpen,
  handlePrevDay,
  handleNextDay,
  pathname,
  calendarView,
  setCalendarView,
  handleLogout,
  auth
}: any) {
  const { setOpenMobile } = useSidebar();

  return (
    <>
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
                <DropdownMenuItem asChild onClick={() => setOpenMobile(false)}>
                  <Link href="/compte" className="flex items-center"><User className="mr-2 h-4 w-4" />Compte</Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { handleLogout(); setOpenMobile(false); }}><LogOut className="mr-2 h-4 w-4" />Déconnexion</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild variant="ghost" className="w-full justify-start h-12" onClick={() => setOpenMobile(false)}>
              <Link href="/login"><LogOut className="mr-2" />Connexion</Link>
            </Button>
          )}
        </SidebarFooter>
      </Sidebar>
      <main className="flex-1 flex flex-col min-h-screen w-full">
        <UsageTimer status={status} auth={auth} userId={user?.uid} />
        <header className={cn("flex flex-col gap-2 border-b bg-card px-4 sticky top-0 z-30 py-3", (status === 'limited' || status === 'trial') && 'mt-10')}>
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              {status === 'trial' && <Badge variant="secondary" className="text-[10px] h-5">Essai</Badge>}
              {status === 'limited' && <Badge variant="destructive" className="text-[10px] h-5">Limité</Badge>}
            </div>
            {isLocationLoading ? <Skeleton className="h-9 w-[120px]" /> : (
              <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                <SelectTrigger className="w-[130px] h-9 text-xs"><SelectValue placeholder="Commune" /></SelectTrigger>
                <SelectContent>{locations.map((loc: string) => <SelectItem key={loc} value={loc}>{loc}</SelectItem>)}</SelectContent>
              </Select>
            )}
          </div>

          <div className="flex items-center justify-between w-full gap-2">
            {showDayNavigator && (
              <div className="flex flex-1 items-center gap-1 rounded-md border bg-background p-1 h-9">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handlePrevDay}><ChevronLeft className="h-4 w-4" /></Button>
                <Popover open={isDatePickerOpen} onOpenChange={setDatePickerOpen}>
                  <PopoverTrigger asChild>
                    <Button variant={'ghost'} className="flex-1 justify-center text-center font-bold h-7 text-xs px-1">
                      {format(selectedDate, 'dd MMM yyyy', { locale: fr })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="center"><Calendar mode="single" selected={selectedDate} onSelect={(d) => { if(d) { setSelectedDate(d); setDatePickerOpen(false); } }} initialFocus /></PopoverContent>
                </Popover>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleNextDay}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            )}

            {pathname === '/calendrier' && (
              <div className="flex items-center gap-1 bg-muted p-1 rounded-lg h-9 ml-auto">
                <Button 
                  variant={calendarView === 'peche' ? 'secondary' : 'ghost'} 
                  size="sm" 
                  className={cn("h-7 px-3 text-[10px] font-bold", calendarView === 'peche' && "bg-background shadow-sm")}
                  onClick={() => setCalendarView('peche')}
                >
                  <Fish className="mr-1 size-3" /> Pêche
                </Button>
                <Button 
                  variant={calendarView === 'champs' ? 'secondary' : 'ghost'} 
                  size="sm" 
                  className={cn("h-7 px-3 text-[10px] font-bold", calendarView === 'champs' && "bg-background shadow-sm")}
                  onClick={() => setCalendarView('champs')}
                >
                  <Leaf className="mr-1 size-3" /> Champs
                </Button>
              </div>
            )}
          </div>
        </header>
        <div className="flex-1 flex flex-col gap-6 p-4 pb-32 md:pb-12 w-full">{children}</div>
        <BottomNav />
      </main>
    </>
  );
}
