
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
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { AppLogo } from './icons';
import { SidebarNav } from './sidebar-nav';
import {
  LogOut,
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  BookOpen,
  AlertCircle,
  User,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useLocation } from '@/context/location-context';
import { useCalendarView } from '@/context/calendar-view-context';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { usePathname, useRouter } from 'next/navigation';
import { useDate } from '@/context/date-context';
import { Popover, PopoverTrigger, PopoverContent } from './ui/popover';
import { Dialog, DialogContent, DialogTrigger } from './ui/dialog';
import { Calendar } from './ui/calendar';
import { format, addDays, subDays, isBefore } from 'date-fns';
import { fr } from 'date-fns/locale';
import Link from 'next/link';
import { useUser, useAuth, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { Skeleton } from './ui/skeleton';
import { signOut } from 'firebase/auth';
import { doc } from 'firebase/firestore';
import type { UserAccount } from '@/lib/types';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from './ui/badge';
import { cn } from '@/lib/utils';
import { BottomNav } from './bottom-nav';
import { useIsMobile } from '@/hooks/use-mobile';

const USAGE_LIMIT_SECONDS = 60;

export function AppShell({ children }: { children: React.ReactNode }) {
  const { locations, selectedLocation, setSelectedLocation } = useLocation();
  const { calendarView, setCalendarView } = useCalendarView();
  const { selectedDate, setSelectedDate } = useDate();
  const pathname = usePathname();
  const router = useRouter();
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [isDatePickerOpen, setDatePickerOpen] = useState(false);

  const userDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);

  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserAccount>(userDocRef);

  const [status, setStatus] = useState<'loading' | 'admin' | 'active' | 'trial' | 'limited'>('loading');
  const [timeLeft, setTimeLeft] = useState(USAGE_LIMIT_SECONDS);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [trialEndDate, setTrialEndDate] = useState<Date | null>(null);

  const isAuthPage = pathname === '/login' || pathname === '/signup';

  useEffect(() => {
    if (isUserLoading) {
      setStatus('loading');
      return;
    }
    if (!user) {
      setStatus('limited');
      return;
    }
    // If we have a user, but are waiting for their profile, stay in loading state.
    if (isProfileLoading || !userProfile) {
      setStatus('loading');
      return;
    }

    // Now we have the user and their profile. We can make a final decision.
    switch (userProfile.subscriptionStatus) {
      case 'admin':
        setStatus('admin');
        break;
      case 'active':
        const expiry = new Date(userProfile.subscriptionExpiryDate!);
        setStatus(isBefore(new Date(), expiry) ? 'active' : 'limited');
        break;
      case 'trial':
        const trialExpiry = new Date(userProfile.subscriptionExpiryDate!);
        setTrialEndDate(trialExpiry);
        setStatus(isBefore(new Date(), trialExpiry) ? 'trial' : 'limited');
        break;
      case 'inactive':
      default:
        setStatus('limited');
        break;
    }
  }, [user, isUserLoading, userProfile, isProfileLoading]);

  // Effect to initialize and run the countdown timer.
  useEffect(() => {
    // Do not run timer logic while auth or profile is loading.
    if (isUserLoading || (user && isProfileLoading)) {
      return;
    }

    if (status !== 'limited' || !auth) return;

    // Initialize timeLeft from localStorage.
    const today = new Date().toISOString().split('T')[0];
    const lastUsageDate = localStorage.getItem('lastUsageDate');
    let dailyUsage = parseInt(localStorage.getItem('dailyUsage') || '0', 10);

    if (lastUsageDate !== today) {
      dailyUsage = 0;
      localStorage.setItem('lastUsageDate', today);
    }
    
    const remainingTime = USAGE_LIMIT_SECONDS - dailyUsage;
    setTimeLeft(remainingTime);

    // Only start the interval if there's time left.
    if (remainingTime > 0) {
      const interval = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [status, auth, user, isUserLoading, isProfileLoading]);

  // Effect to handle side-effects when timeLeft changes (logout, persist to localStorage).
  useEffect(() => {
     // Do not run timer logic while auth or profile is loading.
    if (isUserLoading || isLoggingOut || (user && isProfileLoading)) {
      return;
    }

    if (status !== 'limited' || !auth) return;
    
    // Persist usage to localStorage whenever timeLeft changes.
    const newUsage = USAGE_LIMIT_SECONDS - timeLeft;
    localStorage.setItem('dailyUsage', String(newUsage));

    // Handle logout when time runs out.
    if (timeLeft <= 0) {
      setIsLoggingOut(true);
      toast({
        variant: 'destructive',
        title: 'Limite quotidienne atteinte',
        description: 'Vous allez être déconnecté et redirigé.',
      });
      if (auth.currentUser) {
        signOut(auth).then(() => {
          localStorage.clear();
          sessionStorage.clear();
          router.push('/login');
        });
      } else {
        router.push('/login');
      }
    }
  }, [timeLeft, status, auth, toast, router, isLoggingOut, user, isUserLoading, isProfileLoading]);

  if (isAuthPage) {
    return <>{children}</>;
  }
  
  const handleLogout = async () => {
    if (!auth) return;
    await signOut(auth);
    localStorage.clear();
    sessionStorage.clear();
    router.push('/login');
  };

  const handlePrevDay = () => {
    setSelectedDate(subDays(selectedDate, 1));
  };

  const handleNextDay = () => {
    setSelectedDate(addDays(selectedDate, 1));
  };

  const showDayNavigator =
    ['/', '/lagon', '/peche', '/champs', '/chasse'].includes(pathname);

  const getStatusLabel = () => {
    switch (status) {
        case 'admin': return 'Admin';
        case 'active': return 'Abonné';
        case 'trial': return 'Essai';
        case 'limited': return 'Limité';
        default: return 'Chargement...';
    }
  }

  const renderUserMenu = () => {
    if (isUserLoading || (user && isProfileLoading)) {
      return (
        <div className="flex items-center gap-3 p-2">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="flex flex-col gap-1 group-data-[collapsible=icon]:hidden">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-3 w-12" />
          </div>
        </div>
      )
    }

    if (!user) {
      return (
        <Button asChild className="w-full justify-start h-12 p-2 gap-3" variant="ghost">
          <Link href="/login">
            <LogOut className="h-8 w-8" />
            <div className="text-left group-data-[collapsible=icon]:hidden">
              <p className="font-medium text-sm">Se connecter</p>
            </div>
          </Link>
        </Button>
      );
    }
    
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-start h-12 p-2 gap-3"
          >
            <Avatar className="h-8 w-8">
              <AvatarImage
                src={user.photoURL ?? `https://picsum.photos/seed/${user.uid}/40/40`}
                data-ai-hint="person avatar"
              />
              <AvatarFallback>{user.email?.[0].toUpperCase() ?? 'U'}</AvatarFallback>
            </Avatar>
            <div className="text-left group-data-[collapsible=icon]:hidden">
              <p className="font-medium text-sm truncate" title={user.email!}>{user.email}</p>
              <p className="text-xs text-muted-foreground">{getStatusLabel()}</p>
            </div>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end" forceMount>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">Compte</p>
              <p className="text-xs leading-none text-muted-foreground">
                {user.email}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
           <DropdownMenuItem asChild>
             <Link href="/compte" className="flex items-center w-full">
              <User className="mr-2 h-4 w-4" />
              <span>Gérer le compte</span>
             </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            <span>Se déconnecter</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
        setSelectedDate(date);
        if(isMobile) {
            setDatePickerOpen(false);
        }
    }
  };

  const datePickerTrigger = (
    <Button
        variant={'outline'}
        className="w-[150px] sm:w-[180px] justify-start text-left font-normal h-8"
    >
        <CalendarIcon className="mr-2 h-4 w-4" />
        {format(selectedDate, 'PPP', { locale: fr })}
    </Button>
  );

  const calendarComponent = (
      <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleDateSelect}
          initialFocus
          defaultMonth={selectedDate}
      />
  );

  return (
    <div className={cn(auth?.currentUser && status === 'limited' && timeLeft <= 0 && 'pointer-events-none opacity-50')}>
      <SidebarProvider>
        <Sidebar>
          <SidebarHeader>
            <div className="flex items-center gap-3 p-2">
              <AppLogo className="size-8 text-primary" />
              <h1 className="font-bold text-lg group-data-[collapsible=icon]:hidden">
                Lagon & Brousse
              </h1>
            </div>
          </SidebarHeader>

          <SidebarContent>
            <SidebarNav />
          </SidebarContent>

          <SidebarFooter>
            {renderUserMenu()}
          </SidebarFooter>
        </Sidebar>
        <main className="flex-1">
          {status === 'limited' && (
            <div className="fixed top-0 left-0 right-0 h-10 bg-destructive/90 text-destructive-foreground flex items-center justify-center text-sm font-bold z-50">
                <AlertCircle className="size-4 mr-2" />
                Mode Limité : {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')} restant.
            </div>
          )}
          <header className={cn(
            "flex h-auto min-h-14 items-center gap-4 border-b bg-card px-4 lg:h-[60px] lg:px-6 sticky top-0 z-30 py-2",
            status === 'limited' && 'mt-10'
          )}>
            <SidebarTrigger />
            <div className="w-full flex-1 flex items-center flex-wrap gap-y-2">
              <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
                
                {status === 'trial' && <Badge variant="secondary">Version d'essai</Badge>}
                {status === 'limited' && <Badge variant="destructive">Mode Limité</Badge>}
                <Select
                  value={selectedLocation}
                  onValueChange={setSelectedLocation}
                >
                  <SelectTrigger className="w-[150px] sm:w-[180px]">
                    <SelectValue placeholder="Choisir une commune" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((loc) => (
                      <SelectItem key={loc} value={loc}>
                        {loc}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {pathname === '/calendrier' && (
                  <div className="flex items-center space-x-2">
                    <Label
                      htmlFor="calendar-view"
                      className="text-sm font-medium"
                    >
                      Pêche
                    </Label>
                    <Switch
                      id="calendar-view"
                      checked={calendarView === 'champs'}
                      onCheckedChange={(checked) =>
                        setCalendarView(checked ? 'champs' : 'peche')
                      }
                    />
                    <Label
                      htmlFor="calendar-view"
                      className="text-sm font-medium"
                    >
                      Champs
                    </Label>
                  </div>
                )}

                {showDayNavigator && (
                  <div className="flex items-center gap-1 rounded-md border bg-background p-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={handlePrevDay}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    
                    {isMobile ? (
                      <Dialog open={isDatePickerOpen} onOpenChange={setDatePickerOpen}>
                        <DialogTrigger asChild>
                            {datePickerTrigger}
                        </DialogTrigger>
                        <DialogContent className="w-auto p-0">
                            {calendarComponent}
                        </DialogContent>
                      </Dialog>
                    ) : (
                      <Popover open={isDatePickerOpen} onOpenChange={setDatePickerOpen}>
                        <PopoverTrigger asChild>
                            {datePickerTrigger}
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          {calendarComponent}
                        </PopoverContent>
                      </Popover>
                    )}

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={handleNextDay}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                {pathname === '/calendrier' && calendarView === 'champs' && (
                  <Button asChild variant="outline" size="sm">
                      <Link href="/semis">
                        <BookOpen className="mr-2 h-4 w-4" />
                        Guide de Culture
                      </Link>
                    </Button>
                )}
              </div>

            </div>
          </header>
          <div className={cn(
            "flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6 pb-24 md:pb-6"
          )}>
            {children}
          </div>
          <BottomNav />
        </main>
      </SidebarProvider>
    </div>
  );
}
