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
  
  // State for token preview
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
    try {
      const tokenDoc = await getDoc(doc(firestore, 'access_tokens', token.trim()));
      if (tokenDoc.exists() && tokenDoc.data().status === 'active') {
        setTokenInfo({ duration: tokenDoc.data().durationMonths });
        toast({ title: "Jeton valide !", description: `Ce code active ${tokenDoc.data().durationMonths} mois d'accès.` });
      } else {
        setTokenInfo(null);
        toast({ variant: 'destructive', title: "Jeton invalide", description: "Ce code n'existe pas ou est déjà utilisé." });
      }
    } catch (e) {
      console.error("Token verification error:", e);
      setTokenInfo(null);
      toast({ variant: 'destructive', title: "Erreur", description: "Impossible de vérifier le jeton. Vérifiez votre connexion." });
    } finally {
      setIsValidatingToken(false);
    }
  };

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);

    if (!auth || !firestore) {
      toast({
        variant: "destructive",
        title: "Erreur d'initialisation",
        description: "Le service d'authentification n'est pas disponible. Veuillez réessayer.",
      });
      setIsLoading(false);
      return;
    }

    const emailLower = values.email.toLowerCase();

    try {
      if (mode === 'login') {
        const loginValues = values as z.infer<typeof loginSchema>;

        if (loginValues.rememberMe) {
            localStorage.setItem('rememberedEmail', emailLower);
        } else {
            localStorage.removeItem('rememberedEmail');
        }

        const userCredential = await signInWithEmailAndPassword(auth, emailLower, loginValues.password);

        if (userCredential.user) {
            await ensureUserDocument(firestore, userCredential.user);

            if (loginValues.token && loginValues.token.trim()) {
                const result = await redeemAccessToken(firestore, userCredential.user, loginValues.token.trim());
                if (result.success) {
                    toast({ title: 'Jeton validé !', description: result.message });
                } else {
                    toast({ variant: 'destructive', title: 'Erreur jeton', description: result.message });
                }
            }
        }
        
        toast({ title: 'Connexion réussie!', description: "Vous allez être redirigé." });
        router.push('/');

      } else { // mode === 'signup'
        const signupValues = values as z.infer<typeof signupSchema>;
        const userCredential = await createUserWithEmailAndPassword(auth, emailLower, signupValues.password);
        
        if (userCredential.user) {
          const user = userCredential.user;
          
          await sendEmailVerification(user);

          await updateProfile(user, {
              displayName: signupValues.displayName
          });

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

          if (cgvData) {
            const acceptanceRef = collection(firestore, 'users', user.uid, 'cgv_acceptances');
            await addDoc(acceptanceRef, {
              userId: user.uid,
              acceptedAt: serverTimestamp(),
              version: cgvData.version || 0,
              content: cgvData.content || ""
            });
            
            await updateDoc(doc(firestore, 'users', user.uid), {
              cgvAcceptedAt: new Date().toISOString(),
              cgvVersionSeen: cgvData.version || 0
            });
          }

          if (signupValues.token && signupValues.token.trim()) {
            await redeemAccessToken(firestore, user, signupValues.token.trim());
          }
        }
        
        toast({
          title: 'Inscription réussie!',
          description: "Veuillez vérifier votre boîte de réception pour activer votre compte.",
        });
        router.push('/');
      }
    } catch (error) {
      const authError = error as AuthError;
      let errorMessage = "Une erreur est survenue.";
      if (authError.code === 'auth/invalid-credential') errorMessage = "Email ou mot de passe incorrect.";
      else if (authError.code === 'auth/email-already-in-use') errorMessage = "Email déjà utilisé.";
      
      toast({ variant: "destructive", title: "Erreur", description: errorMessage });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col space-y-6">
        
        {/* ÉTAPE 1 : JETON ET EXPIRATION */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <Badge className="bg-primary size-5 rounded-full flex items-center justify-center p-0">1</Badge>
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Validation du Jeton</h3>
          </div>
          
          <div className="p-4 bg-primary/5 border-2 rounded-2xl space-y-3 animate-in fade-in">
            <FormField
              control={form.control}
              name="token"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary">
                    <Ticket className="size-3" /> Jeton d'accès Premium (Optionnel)
                  </FormLabel>
                  <FormControl>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input 
                          placeholder="LBN-XXXX-XXXX" 
                          {...field} 
                          autoComplete="off" 
                          autoCapitalize="none"
                          autoCorrect="off"
                          className="pl-10 font-mono tracking-wider h-12 border-2 bg-white" 
                        />
                        <div className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground"><Ticket className="h-5 w-5" /></div>
                      </div>
                      <Button 
                        type="button" 
                        variant="outline" 
                        className="h-12 border-2 font-black uppercase text-[10px] shrink-0 bg-white shadow-sm transition-all active:scale-95"
                        onClick={handleVerifyToken}
                        disabled={isValidatingToken || !field.value}
                      >
                        {isValidatingToken ? <RefreshCw className="animate-spin size-4" /> : "Vérifier"}
                      </Button>
                    </div>
                  </FormControl>
                  {tokenInfo && (
                    <div className="mt-3 p-3 bg-green-50 border-2 border-green-100 rounded-xl animate-in zoom-in-95 shadow-sm">
                      <p className="text-[10px] font-black uppercase text-green-700 flex items-center gap-2">
                        <CheckCircle2 className="size-3" /> Jeton Valide
                      </p>
                      <p className="text-xs font-bold mt-1 text-green-900">
                        Active {tokenInfo.duration} mois d'accès Premium.
                      </p>
                      <p className="text-[9px] font-bold text-green-600 uppercase mt-0.5 border-t border-green-100 pt-1.5 flex items-center justify-between">
                        <span>Fin d'activation :</span>
                        <span>{format(addMonths(new Date(), tokenInfo.duration), 'dd MMMM yyyy', { locale: fr })}</span>
                      </p>
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <div className="border-t border-dashed border-slate-200" />

        {/* ÉTAPE 2 : IDENTIFIANTS ET PROFIL */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <Badge className="bg-slate-400 size-5 rounded-full flex items-center justify-center p-0">2</Badge>
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Mes Identifiants</h3>
          </div>

          {mode === 'signup' && (
            <div className="p-4 bg-muted/10 border-2 rounded-2xl space-y-4 animate-in fade-in">
              <div className="flex items-center gap-2 border-b border-dashed border-primary/20 pb-2">
                <Briefcase className="size-4 text-primary" />
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-800">Type de compte</h3>
              </div>
              
              <FormField
                control={form.control}
                name="accountType"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="grid grid-cols-2 gap-4"
                      >
                        <div>
                          <RadioGroupItem value="client" id="type-client" className="peer sr-only" />
                          <Label
                            htmlFor="type-client"
                            className="flex flex-col items-center justify-between rounded-xl border-2 border-muted bg-white p-4 hover:bg-muted/50 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 transition-all cursor-pointer"
                          >
                            <UserIcon className="mb-2 size-6 text-muted-foreground peer-data-[state=checked]:text-primary" />
                            <span className="text-[10px] font-black uppercase">Utilisateur</span>
                          </Label>
                        </div>
                        <div>
                          <RadioGroupItem value="professional" id="type-pro" className="peer sr-only" />
                          <Label
                            htmlFor="type-pro"
                            className="flex flex-col items-center justify-between rounded-xl border-2 border-muted bg-white p-4 hover:bg-muted/50 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 transition-all cursor-pointer"
                          >
                            <Briefcase className="mb-2 size-6 text-muted-foreground peer-data-[state=checked]:text-primary" />
                            <span className="text-[10px] font-black uppercase">Professionnel</span>
                          </Label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {accountType === 'professional' && (
                <FormField
                  control={form.control}
                  name="ridet"
                  render={({ field }) => (
                    <FormItem className="animate-in zoom-in-95 duration-200">
                      <FormLabel className="text-[10px] font-black uppercase text-primary">Numéro RIDET (Obligatoire)</FormLabel>
                      <FormControl>
                        <Input placeholder="0 000 000.000" {...field} className="h-12 border-2 font-black tracking-widest uppercase bg-white" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>
          )}

          {mode === 'signup' && (
            <FormField
              control={form.control}
              name="displayName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{accountType === 'professional' ? "Nom de l'entreprise" : "Nom d'utilisateur"}</FormLabel>
                  <FormControl>
                    <Input placeholder={accountType === 'professional' ? "Ex: Etablissements Martin" : "Votre nom"} {...field} autoComplete="name" className="h-12 border-2" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          
          {mode === 'signup' && (
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="region"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1.5"><Globe className="size-3 text-primary" /> Région</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-12 border-2 text-[10px] font-black uppercase bg-white">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {regions.map(reg => <SelectItem key={reg} value={reg} className="text-[10px] font-black uppercase">{reg}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="commune"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1.5"><MapPin className="size-3 text-primary" /> Commune</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-12 border-2 text-xs font-bold bg-white">
                          <SelectValue placeholder="Choisir..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="max-h-64">
                        {availableLocations.map(loc => (
                          <SelectItem key={loc} value={loc} className="text-xs font-bold">{loc}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}

          <div className="space-y-4 animate-in fade-in">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input placeholder="votre@email.com" {...field} autoComplete="email" className="h-12 border-2" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>Mot de passe</FormLabel>
                    {mode === 'login' && (
                      <ForgotPasswordDialog>
                          <button type="button" className="text-sm font-medium text-primary hover:underline -translate-y-px">
                            Mot de passe oublié ?
                          </button>
                      </ForgotPasswordDialog>
                    )}
                  </div>
                  <FormControl>
                    <div className="relative">
                      <Input 
                        type={showPassword ? 'text' : 'password'} 
                        placeholder="********" {...field} 
                        autoComplete={mode === 'login' ? 'current-password' : 'new-password'} 
                        className="h-12 border-2"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground"
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {mode === 'login' && (
          <FormField
            control={form.control}
            name="rememberMe"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                <div className="space-y-1 leading-none"><FormLabel className="text-xs font-bold">Se souvenir de moi</FormLabel></div>
              </FormItem>
            )}
          />
        )}

        {mode === 'signup' && (
          <div className="p-4 bg-muted/5 border-2 rounded-2xl space-y-4 animate-in fade-in">
            <div className="flex items-center gap-2 border-b border-dashed border-primary/20 pb-2">
              <Phone className="size-4 text-primary" />
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-800">Coordonnées</h3>
            </div>
            
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <FormField
                  control={form.control}
                  name="phoneCountryCode"
                  render={({ field }) => (
                    <FormItem className="col-span-1">
                      <FormLabel className="text-[10px] font-black uppercase">Code</FormLabel>
                      <FormControl>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-10 border-2 font-black text-xs bg-white">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="+687" className="text-xs font-black">+687 (NC)</SelectItem>
                            <SelectItem value="+689" className="text-xs font-black">+689 (PF)</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phoneNumber"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel className="text-[10px] font-black uppercase">Mobile (Obligatoire)</FormLabel>
                      <FormControl>
                        <Input type="tel" placeholder="00 00 00" {...field} className="h-10 border-2 font-black bg-white" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </div>
        )}

        {mode === 'signup' && (
          <FormField
            control={form.control}
            name="acceptCgv"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0 pt-2">
                <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel className="text-xs">
                    J'ai lu et j'accepte les{' '}
                    <Dialog>
                      <DialogTrigger asChild>
                        <button type="button" className="text-primary font-bold hover:underline">Conditions Générales de Vente</button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col p-0 overflow-hidden">
                        <DialogHeader className="p-6 bg-muted/30 border-b">
                          <DialogTitle className="flex items-center gap-2 font-black uppercase tracking-tighter">
                            <ScrollText className="size-5 text-primary" /> Conditions Générales de Vente
                          </DialogTitle>
                        </DialogHeader>
                        <ScrollArea className="flex-1 p-6">
                          <div className="prose prose-sm font-medium leading-relaxed text-muted-foreground whitespace-pre-wrap">
                            {cgvData?.content || "Chargement..."}
                          </div>
                        </ScrollArea>
                        <DialogFooter className="p-4 border-t bg-muted/10">
                          <DialogClose asChild><Button className="w-full font-black uppercase h-12">Compris</Button></DialogClose>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </FormLabel>
                  <FormMessage />
                </div>
              </FormItem>
            )}
          />
        )}

        <div className="pt-4">
          <Button 
            type="submit" 
            className="w-full h-14 font-black uppercase tracking-widest shadow-xl text-base transition-all active:scale-[0.98]" 
            disabled={isLoading || (mode === 'signup' && !form.getValues('acceptCgv'))}
          >
            {isLoading ? <RefreshCw className="animate-spin mr-2 size-5" /> : (mode === 'login' ? 'Se connecter' : "S'inscrire")}
          </Button>
        </div>
      </form>
    </Form>
  );
}
