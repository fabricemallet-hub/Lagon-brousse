
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useMemo } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendEmailVerification,
  AuthError,
} from 'firebase/auth';
import { doc, collection, addDoc, serverTimestamp, setDoc, updateDoc, getDoc } from 'firebase/firestore';
import { ForgotPasswordDialog } from './forgot-password-dialog';
import { Eye, EyeOff, Ticket, MapPin, ScrollText, Globe, Bell, Mail, Smartphone, Phone, Home, Briefcase, User as UserIcon, Zap, CheckCircle2, RefreshCw, ChevronDown } from 'lucide-react';
import { redeemAccessToken } from '@/lib/token-utils';
import { ensureUserDocument } from '@/lib/user-utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { CgvSettings, Region } from '@/lib/types';
import { locationsByRegion, regions } from '@/lib/locations';
import { addMonths, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Label } from './ui/label';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { cn } from '@/lib/utils';

type AuthFormProps = {
  mode: 'login' | 'signup';
};

const loginSchema = z.object({
  email: z.string().email({ message: 'Veuillez entrer une adresse email valide.' }),
  password: z.string().min(6, { message: 'Le mot de passe doit contenir au moins 6 caractères.' }),
  token: z.string().optional(),
  rememberMe: z.boolean().optional(),
});

const signupSchema = z.object({
  displayName: z.string().min(3, { message: 'Le nom doit contenir au moins 3 caractères.' }),
  email: z.string().email({ message: 'Veuillez entrer une adresse email valide.' }),
  password: z.string().min(6, { message: 'Le mot de passe doit contenir au moins 6 caractères.' }),
  region: z.enum(['CALEDONIE', 'TAHITI']),
  commune: z.string().min(1, { message: 'Veuillez choisir votre commune.' }),
  accountType: z.enum(['client', 'professional']),
  ridet: z.string().optional(),
  phoneCountryCode: z.string().min(1),
  phoneNumber: z.string().min(6, { message: 'Numéro de mobile obligatoire (min. 6 chiffres).' }),
  landline: z.string().optional(),
  address: z.string().optional(),
  token: z.string().optional(),
  acceptCgv: z.boolean().refine(val => val === true, {
    message: "Vous devez accepter les conditions générales de vente."
  }),
  subscribedCategories: z.array(z.string()).default(['Pêche', 'Chasse', 'Jardinage']),
  allowsPromoEmails: z.boolean().default(true),
  allowsPromoPush: z.boolean().default(true),
  allowsPromoSMS: z.boolean().default(true),
}).superRefine((data, ctx) => {
  if (data.accountType === 'professional' && (!data.ridet || data.ridet.trim() === "")) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Le numéro RIDET est obligatoire pour les professionnels.",
      path: ['ridet'],
    });
  }
});

export function AuthForm({ mode }: AuthFormProps) {
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const [tokenInfo, setTokenInfo] = useState<{ duration: number } | null>(null);
  const [isValidatingToken, setIsValidatingToken] = useState(false);

  const formSchema = mode === 'signup' ? signupSchema : loginSchema;

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      displayName: '',
      email: '',
      password: '',
      region: 'CALEDONIE',
      commune: 'Nouméa',
      accountType: 'client',
      ridet: '',
      phoneCountryCode: '+687',
      phoneNumber: '',
      landline: '',
      address: '',
      token: '',
      rememberMe: false,
      acceptCgv: false,
      subscribedCategories: ['Pêche', 'Chasse', 'Jardinage'],
      allowsPromoEmails: true,
      allowsPromoPush: true,
      allowsPromoSMS: true,
    },
  });

  const selectedRegion = form.watch('region') as Region;
  const accountType = form.watch('accountType');

  const availableLocations = useMemo(() => {
    return Object.keys(locationsByRegion[selectedRegion] || {}).sort();
  }, [selectedRegion]);

  useEffect(() => {
    if (mode === 'signup' && selectedRegion) {
      form.setValue('commune', availableLocations[0]);
      form.setValue('phoneCountryCode', selectedRegion === 'CALEDONIE' ? '+687' : '+689');
    }
  }, [selectedRegion, availableLocations, form, mode]);

  const cgvRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'app_settings', 'cgv');
  }, [firestore]);
  const { data: cgvData } = useDoc<CgvSettings>(cgvRef);
  
  useEffect(() => {
    if (mode === 'login') {
        const rememberedEmail = localStorage.getItem('rememberedEmail');
        if (rememberedEmail) {
            form.setValue('email', rememberedEmail);
            form.setValue('rememberMe', true);
        }
    }
  }, [form, mode]);

  const handleVerifyToken = async () => {
    const token = form.getValues('token');
    if (!token?.trim() || !firestore) return;
    
    setIsValidatingToken(true);
    setTokenInfo(null);
    
    try {
      const cleanToken = token.trim();
      const tokenDocRef = doc(firestore, 'access_tokens', cleanToken);
      const tokenDoc = await getDoc(tokenDocRef);
      
      if (tokenDoc.exists()) {
        const data = tokenDoc.data();
        if (data.status === 'active') {
            setTokenInfo({ duration: data.durationMonths });
            toast({ title: "Jeton valide !", description: `Ce code active ${data.durationMonths} mois d'accès.` });
        } else {
            toast({ variant: 'destructive', title: "Jeton expiré", description: "Ce code a déjà été utilisé." });
        }
      } else {
        toast({ variant: 'destructive', title: "Jeton inconnu", description: "Ce code n'existe pas." });
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: "Erreur technique", description: "Vérification impossible pour le moment." });
    } finally {
      setIsValidatingToken(false);
    }
  };

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);

    if (!auth || !firestore) {
      toast({ variant: "destructive", title: "Erreur", description: "Service indisponible." });
      setIsLoading(false);
      return;
    }

    const emailLower = values.email.toLowerCase();

    try {
      if (mode === 'login') {
        const loginValues = values as z.infer<typeof loginSchema>;
        if (loginValues.rememberMe) localStorage.setItem('rememberedEmail', emailLower);
        else localStorage.removeItem('rememberedEmail');

        const userCredential = await signInWithEmailAndPassword(auth, emailLower, loginValues.password);

        if (userCredential.user) {
            await ensureUserDocument(firestore, userCredential.user);
            if (loginValues.token && loginValues.token.trim()) {
                await redeemAccessToken(firestore, userCredential.user, loginValues.token.trim());
            }
        }
        
        toast({ title: 'Connecté!' });
        router.push('/');

      } else { // signup
        const signupValues = values as z.infer<typeof signupSchema>;
        const userCredential = await createUserWithEmailAndPassword(auth, emailLower, signupValues.password);
        
        if (userCredential.user) {
          const user = userCredential.user;
          await sendEmailVerification(user);
          await updateProfile(user, { displayName: signupValues.displayName });

          const userDocRef = doc(firestore, 'users', user.uid);
          const isPro = signupValues.accountType === 'professional';
          
          await setDoc(userDocRef, {
            id: user.uid,
            email: emailLower,
            displayName: signupValues.displayName,
            role: isPro ? 'professional' : 'client',
            subscriptionStatus: isPro ? 'professional' : 'trial',
            selectedRegion: signupValues.region,
            lastSelectedLocation: signupValues.commune,
            phoneCountryCode: signupValues.phoneCountryCode,
            phoneNumber: signupValues.phoneNumber,
            landline: signupValues.landline || '',
            address: signupValues.address || '',
            ridet: isPro ? signupValues.ridet : null,
            subscribedCategories: signupValues.subscribedCategories,
            allowsPromoEmails: signupValues.allowsPromoEmails,
            allowsPromoPush: signupValues.allowsPromoPush,
            allowsPromoSMS: signupValues.allowsPromoSMS,
            subscriptionStartDate: new Date().toISOString(),
            subscriptionExpiryDate: addMonths(new Date(), isPro ? 12 : 3).toISOString()
          });

          if (signupValues.token && signupValues.token.trim()) {
            await redeemAccessToken(firestore, user, signupValues.token.trim());
          }
        }
        
        toast({ title: 'Compte créé!', description: "Vérifiez vos emails." });
        router.push('/');
      }
    } catch (error) {
      const authError = error as AuthError;
      let errorMessage = "Erreur d'authentification.";
      if (authError.code === 'auth/invalid-credential') errorMessage = "Email ou mot de passe incorrect.";
      toast({ variant: "destructive", title: "Erreur", description: errorMessage });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col space-y-6">
        
        {/* ÉTAPE 1 : JETON */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <Badge className="bg-primary size-5 rounded-full flex items-center justify-center p-0 text-[10px] font-black">1</Badge>
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Jeton Premium (Optionnel)</h3>
          </div>
          
          <div className="p-4 bg-primary/5 border-2 rounded-2xl space-y-3">
            <FormField
              control={form.control}
              name="token"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input 
                          placeholder="LBN-XXXX-XXXX" 
                          {...field} 
                          autoComplete="off" 
                          autoCapitalize="none"
                          className="pl-10 font-mono tracking-wider h-12 border-2 bg-white" 
                        />
                        <Ticket className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      </div>
                      <Button 
                        type="button" 
                        variant="outline" 
                        className="h-12 border-2 font-black uppercase text-[10px]"
                        onClick={handleVerifyToken}
                        disabled={isValidatingToken || !field.value}
                      >
                        {isValidatingToken ? <RefreshCw className="animate-spin size-4" /> : "Vérifier"}
                      </Button>
                    </div>
                  </FormControl>
                  {tokenInfo && (
                    <div className="mt-3 p-3 bg-green-50 border-2 border-green-100 rounded-xl animate-in zoom-in-95">
                      <p className="text-[10px] font-black uppercase text-green-700 flex items-center gap-2"><CheckCircle2 className="size-3" /> Jeton Valide</p>
                      <p className="text-[9px] font-bold text-green-600 uppercase mt-1">
                        Fin d'activation : {format(addMonths(new Date(), tokenInfo.duration), 'dd MMMM yyyy', { locale: fr })}
                      </p>
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* ÉTAPE 2 : IDENTIFIANTS */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <Badge className="bg-slate-400 size-5 rounded-full flex items-center justify-center p-0 text-[10px] font-black">2</Badge>
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Mes Identifiants</h3>
          </div>

          {mode === 'signup' && (
            <div className="p-4 bg-muted/10 border-2 rounded-2xl space-y-4">
              <FormField
                control={form.control}
                name="accountType"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="grid grid-cols-2 gap-4">
                        <div>
                          <RadioGroupItem value="client" id="type-client" className="peer sr-only" />
                          <Label htmlFor="type-client" className="flex flex-col items-center justify-center rounded-xl border-2 bg-white p-4 hover:bg-muted/50 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 transition-all cursor-pointer">
                            <UserIcon className="mb-2 size-6" />
                            <span className="text-[10px] font-black uppercase">Utilisateur</span>
                          </Label>
                        </div>
                        <div>
                          <RadioGroupItem value="professional" id="type-pro" className="peer sr-only" />
                          <Label htmlFor="type-pro" className="flex flex-col items-center justify-center rounded-xl border-2 bg-white p-4 hover:bg-muted/50 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 transition-all cursor-pointer">
                            <Briefcase className="mb-2 size-6" />
                            <span className="text-[10px] font-black uppercase">Pro</span>
                          </Label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                  </FormItem>
                )}
              />
              {accountType === 'professional' && (
                <FormField
                  control={form.control}
                  name="ridet"
                  render={({ field }) => (
                    <FormItem><FormLabel className="text-[10px] font-black uppercase text-primary">Numéro RIDET</FormLabel><FormControl><Input placeholder="0 000 000.000" {...field} className="h-12 border-2 bg-white" /></FormControl><FormMessage /></FormItem>
                  )}
                />
              )}
            </div>
          )}

          <div className="space-y-4">
            {mode === 'signup' && (
              <FormField
                control={form.control}
                name="displayName"
                render={({ field }) => (
                  <FormItem><FormLabel>Nom</FormLabel><FormControl><Input placeholder="Votre nom" {...field} className="h-12 border-2" /></FormControl><FormMessage /></FormItem>
                )}
              />
            )}
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem><FormLabel>Email</FormLabel><FormControl><Input placeholder="votre@email.com" {...field} className="h-12 border-2" /></FormControl><FormMessage /></FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>Mot de passe</FormLabel>
                    {mode === 'login' && <ForgotPasswordDialog><button type="button" className="text-sm font-medium text-primary hover:underline">Oublié ?</button></ForgotPasswordDialog>}
                  </div>
                  <FormControl>
                    <div className="relative">
                      <Input type={showPassword ? 'text' : 'password'} placeholder="********" {...field} className="h-12 border-2" />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {mode === 'signup' && (
          <FormField
            control={form.control}
            name="acceptCgv"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0 pt-2">
                <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                <div className="space-y-1 leading-none"><FormLabel className="text-xs">J'accepte les <span className="text-primary font-bold">Conditions Générales</span></FormLabel></div>
              </FormItem>
            )}
          />
        )}

        <Button type="submit" className="w-full h-14 font-black uppercase tracking-widest shadow-xl text-base" disabled={isLoading}>
          {isLoading ? <RefreshCw className="animate-spin mr-2 size-5" /> : (mode === 'login' ? 'Se connecter' : "S'inscrire")}
        </Button>
      </form>
    </Form>
  );
}
