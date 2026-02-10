
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
  Calendar as CalendarIcon,
  Fish,
  Leaf,
  MailWarning,
  RefreshCw,
  ShieldCheck
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
import { signOut, sendEmailVerification } from 'firebase/auth';
import { doc } from 'firebase/firestore';
import type { UserAccount } from '@/lib/types';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { BottomNav } from './bottom-nav';
import { UsageTimer } from './usage-timer';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { locations, selectedLocation, setSelectedLocation, isLocationLoading } = useLocation();
  const { selectedDate, setSelectedDate } = useDate();
  const { calendarView, setCalendarView } = useCalendarView();
  const pathname = usePathname();
  const router = useRouter();
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isDatePickerOpen, setDatePickerOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const userDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);

  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserAccount>(userDocRef);

  const status = useMemo(() => {
    if (isUserLoading || (user && isProfileLoading)) return 'loading';
    if (!user) return 'limited';
    if (!userProfile) return 'limited';

    const expiryDate = userProfile.subscriptionExpiryDate ? new Date(userProfile.subscriptionExpiryDate) : null;
    const isValid = expiryDate && !isNaN(expiryDate.getTime()) && isBefore(new Date(), expiryDate);

    switch (userProfile.subscriptionStatus) {
      case 'admin': return 'admin';
      case 'active':
        return isValid ? 'active' : 'limited';
      case 'trial':
        return isValid ? 'trial' : 'limited';
      default: return 'limited';
    }
  }, [user, isUserLoading, userProfile, isProfileLoading]);

  const isAuthPage = pathname === '/login' || pathname === '/signup';

  useEffect(() => {
    if (!isUserLoading && !user && !isAuthPage && pathname !== '/privacy-policy') {
      router.push('/login');
    }
  }, [user, isUserLoading, isAuthPage, pathname, router]);

  const handleLogout = useCallback(async () => { 
    if (auth) { 
      await signOut(auth); 
      sessionStorage.clear(); 
      router.push('/login'); 
    } 
  }, [auth, router]);

  const handleResendEmail = async () => {
    if (!user) return;
    try {
      await sendEmailVerification(user);
      toast({ title: "Email envoyé", description: "Le lien de validation a été renvoyé à votre adresse." });
    } catch (e) {
      toast({ variant: 'destructive', title: "Erreur", description: "Veuillez patienter avant de renvoyer un e-mail." });
    }
  };

  const handleCheckVerification = async () => {
    if (!user) return;
    setIsRefreshing(true);
    try {
      await user.reload();
      if (user.emailVerified) {
        toast({ title: "Compte validé !", description: "Vous pouvez désormais accéder à l'application." });
      } else {
        toast({ title: "Non validé", description: "L'e-mail n'a pas encore été vérifié." });
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  const handlePrevDay = useCallback(() => setSelectedDate(subDays(selectedDate, 1)), [selectedDate, setSelectedDate]);
  const handleNextDay = useCallback(() => setSelectedDate(addDays(selectedDate, 1)), [selectedDate, setSelectedDate]);

  if (isAuthPage) return <div className="w-full min-h-screen">{children}</div>;

  // EMAIL VERIFICATION GUARD
  if (user && !user.isAnonymous && !user.emailVerified && !isAuthPage) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-2 shadow-2xl">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto size-20 rounded-full bg-primary/10 flex items-center justify-center border-4 border-background shadow-lg">
              <MailWarning className="size-10 text-primary animate-pulse" />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-2xl font-black uppercase tracking-tighter">Vérifiez votre Email</CardTitle>
              <CardDescription className="font-bold text-xs uppercase text-muted-foreground">
                Validation requise pour {user.email}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 text-center">
            <p className="text-sm font-medium leading-relaxed text-muted-foreground">
              Un lien de validation vous a été envoyé. Veuillez cliquer dessus pour activer votre compte et accéder aux outils tactiques.
            </p>
            <div className="bg-muted/30 p-4 rounded-xl border-2 border-dashed space-y-3">
              <Button onClick={handleCheckVerification} disabled={isRefreshing} className="w-full h-12 font-black uppercase text-xs tracking-widest gap-2">
                {isRefreshing ? <RefreshCw className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
                J'ai vérifié mon adresse
              </Button>
              <Button variant="outline" onClick={handleResendEmail} className="w-full h-10 font-black uppercase text-[10px] tracking-widest border-2">
                Renvoyer le lien
              </Button>
            </div>
          </CardContent>
          <CardFooter>
            <Button variant="ghost" onClick={handleLogout} className="w-full font-bold uppercase text-[10px] text-destructive hover:bg-destructive/5">
              <LogOut className="mr-2 size-3" /> Se déconnecter
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

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
        <SidebarHeader><div className="flex items-center gap-3 p-2 group-data-[collapsible=icon]:p-1"><AppLogo className="size-8 text-primary" /><h1 className="font-black uppercase tracking-tighter text-sm group-data-[collapsible=icon]:hidden">Lagon & Brousse</h1></div></SidebarHeader>
        <SidebarContent><SidebarNav /></SidebarContent>
        <SidebarFooter>
          {isUserLoading || (user && isProfileLoading) ? (
            <div className="flex items-center gap-3 p-2"><Skeleton className="h-8 w-8 rounded-full" /><div className="flex flex-col gap-1"><Skeleton className="h-4 w-20" /></div></div>
          ) : user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="w-full justify-start h-12 p-2 gap-3 bg-accent text-accent-foreground shadow-sm overflow-hidden text-white">
                  <Avatar className="h-8 w-8 border-2 border-background shrink-0"><AvatarFallback className="font-black">{user.email?.[0].toUpperCase()}</AvatarFallback></Avatar>
                  <div className="text-left group-data-[collapsible=icon]:hidden min-w-0 flex-1"><p className="font-bold text-xs truncate w-full">{user.email}</p></div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="right" sideOffset={10} className="w-56">
                <DropdownMenuItem asChild onClick={() => setOpenMobile(false)}>
                  <Link href="/compte" className="flex items-center"><User className="mr-2 h-4 w-4" />Compte</Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { handleLogout(); setOpenMobile(false); }} className="text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />Déconnexion
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild variant="ghost" className="w-full justify-start h-12" onClick={() => setOpenMobile(false)}>
              <Link href="/login"><LogOut className="mr-2" />Connexion</Link>
            </Button>
          )}
        </SidebarFooter>
      </Sidebar>
      <main className="flex-1 flex flex-col min-h-screen w-full relative">
        <UsageTimer status={status} auth={auth} userId={user?.uid} />
        <header className={cn("flex flex-col gap-2 border-b bg-card px-4 sticky top-0 z-30 py-3 transition-all duration-300", (status === 'limited' || status === 'trial') && 'mt-10')}>
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              {status === 'trial' && <Badge variant="secondary" className="text-[10px] h-5 font-black uppercase">Essai</Badge>}
              {status === 'limited' && <Badge variant="destructive" className="text-[10px] h-5 font-black uppercase">Limité</Badge>}
            </div>
            {isLocationLoading ? <Skeleton className="h-9 w-[120px]" /> : (
              <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                <SelectTrigger className="w-[130px] h-9 text-xs font-bold border-2"><SelectValue placeholder="Commune" /></SelectTrigger>
                <SelectContent className="max-h-80">{locations.map((loc: string) => <SelectItem key={loc} value={loc} className="text-xs font-bold">{loc}</SelectItem>)}</SelectContent>
              </Select>
            )}
          </div>

          <div className="flex items-center justify-between w-full gap-2">
            {showDayNavigator && (
              <div className="flex flex-1 items-center gap-1 rounded-full border-2 border-primary/10 bg-background/80 backdrop-blur-md p-1 h-11 shadow-sm overflow-hidden">
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full hover:bg-primary/10 text-primary transition-all active:scale-75 shrink-0" onClick={handlePrevDay}><ChevronLeft className="h-5 w-5" /></Button>
                <Popover open={isDatePickerOpen} onOpenChange={setDatePickerOpen}>
                  <PopoverTrigger asChild>
                    <Button variant={'ghost'} className="flex-1 justify-center text-center font-black h-9 text-[11px] px-1 uppercase tracking-tight hover:bg-transparent active:scale-95 flex items-center min-w-0">
                      <CalendarIcon className="mr-2 h-4 w-4 text-accent shrink-0" />
                      <span className="truncate">{format(selectedDate, 'dd MMMM yyyy', { locale: fr })}</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 border-none bg-transparent shadow-none" align="center">
                    <Calendar mode="single" selected={selectedDate} onSelect={(d) => { if(d) { setSelectedDate(d); setDatePickerOpen(false); } }} initialFocus />
                  </PopoverContent>
                </Popover>
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full hover:bg-primary/10 text-primary transition-all active:scale-75 shrink-0" onClick={handleNextDay}><ChevronRight className="h-5 w-5" /></Button>
              </div>
            )}

            {pathname === '/calendrier' && (
              <div className="flex items-center gap-1 bg-muted p-1 rounded-lg h-9 ml-auto shrink-0">
                <Button 
                  variant={calendarView === 'peche' ? 'secondary' : 'ghost'} 
                  size="sm" 
                  className={cn("h-7 px-3 text-[10px] font-black uppercase", calendarView === 'peche' && "bg-background shadow-sm")}
                  onClick={() => setCalendarView('peche')}
                >
                  <Fish className="mr-1 size-3" /> Pêche
                </Button>
                <Button 
                  variant={calendarView === 'champs' ? 'secondary' : 'ghost'} 
                  size="sm" 
                  className={cn("h-7 px-3 text-[10px] font-black uppercase", calendarView === 'champs' && "bg-background shadow-sm")}
                  onClick={() => setCalendarView('champs')}
                >
                  <Leaf className="mr-1 size-3" /> Champs
                </Button>
              </div>
            )}
          </div>
        </header>
        <div className="flex-1 flex flex-col gap-6 p-4 pb-32 md:pb-12 w-full transform-gpu">
          {children}
        </div>
        <BottomNav />
      </main>
    </>
  );
}
