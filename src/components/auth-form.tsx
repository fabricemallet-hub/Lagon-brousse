
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
import { useAuth, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  AuthError,
} from 'firebase/auth';
import { doc } from 'firebase/firestore';
import { ForgotPasswordDialog } from './forgot-password-dialog';
import { Eye, EyeOff, Ticket, FileText, ScrollText } from 'lucide-react';
import { ensureUserDocument } from '@/lib/user-utils';
import { redeemAccessToken } from '@/lib/token-utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { CgvSettings } from '@/lib/types';

type AuthFormProps = {
  mode: 'login' | 'signup';
};

// Schéma pour la connexion
const loginSchema = z.object({
  email: z.string().email({ message: 'Veuillez entrer une adresse email valide.' }),
  password: z.string().min(6, { message: 'Le mot de passe doit contenir au moins 6 caractères.' }),
  token: z.string().optional(),
  rememberMe: z.boolean().optional(),
});

// Schéma pour l'inscription
const signupSchema = z.object({
  displayName: z.string().min(3, { message: 'Le nom doit contenir au moins 3 caractères.' }),
  email: z.string().email({ message: 'Veuillez entrer une adresse email valide.' }),
  password: z.string().min(6, { message: 'Le mot de passe doit contenir au moins 6 caractères.' }),
  token: z.string().optional(),
  acceptCgv: z.boolean().refine(val => val === true, {
    message: "Vous devez accepter les conditions générales de vente."
  }),
});


export function AuthForm({ mode }: AuthFormProps) {
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const formSchema = mode === 'signup' ? signupSchema : loginSchema;

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      displayName: '',
      email: '',
      password: '',
      token: '',
      rememberMe: false,
      acceptCgv: false,
    },
  });

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


  const onValidationErrors = (errors: any) => {
    // This function can be used for debugging validation errors
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

    try {
      if (mode === 'login') {
        const loginValues = values as z.infer<typeof loginSchema>;

        if (loginValues.rememberMe) {
            localStorage.setItem('rememberedEmail', loginValues.email);
        } else {
            localStorage.removeItem('rememberedEmail');
        }

        const userCredential = await signInWithEmailAndPassword(auth, loginValues.email, loginValues.password);

        if (userCredential.user && loginValues.token) {
            const result = await redeemAccessToken(firestore, userCredential.user, loginValues.token);
            if (result.success) {
              toast({
                title: 'Jeton validé !',
                description: result.message,
              });
            } else {
              toast({
                variant: 'destructive',
                title: 'Erreur de jeton',
                description: result.message,
              });
            }
        }
        
        toast({
            title: 'Connexion réussie!',
            description: "Vous allez être redirigé vers la page d'accueil.",
        });
        router.push('/');

      } else { // mode === 'signup'
        const signupValues = values as z.infer<typeof signupSchema>;
        const userCredential = await createUserWithEmailAndPassword(auth, signupValues.email, signupValues.password);
        
        if (userCredential.user) {
          const user = userCredential.user;
          await updateProfile(user, {
              displayName: signupValues.displayName
          });

          // Ensure user document is created BEFORE attempting to redeem a token.
          await ensureUserDocument(firestore, user, signupValues.displayName);

          if (signupValues.token) {
            const result = await redeemAccessToken(firestore, user, signupValues.token);
            if (result.success) {
              toast({
                title: 'Jeton validé !',
                description: result.message,
              });
            } else {
              toast({
                variant: 'destructive',
                title: 'Erreur de jeton',
                description: result.message,
              });
            }
          }
        }
        
        toast({
          title: 'Inscription réussie!',
          description: "Vous allez être redirigé vers la page d'accueil.",
        });
        router.push('/');
      }
    } catch (error) {
      const authError = error as AuthError;

      let errorMessage = "Une erreur inattendue est survenue. Veuillez réessayer.";

      if (authError && authError.code) {
        switch (authError.code) {
          case 'auth/invalid-credential':
          case 'auth/user-not-found':
          case 'auth/wrong-password':
            errorMessage = "L'email ou le mot de passe est incorrect. Veuillez vérifier vos informations ou cliquer sur 'Mot de passe oublié ?' pour le réinitialiser.";
            break;
          case 'auth/email-already-in-use':
            errorMessage = 'Cette adresse email est déjà utilisée par un autre compte.';
            break;
          case 'auth/weak-password':
            errorMessage = 'Le mot de passe est trop faible. Il doit contenir au moins 6 caractères.';
            break;
          case 'auth/too-many-requests':
            errorMessage = "L'accès à ce compte a été temporairement désactivé en raison de nombreuses tentatives de connexion infructueuses. Veuillez réessayer plus tard.";
            break;
          case 'auth/network-request-failed':
            errorMessage = "Un problème de réseau est survenu. Veuillez vérifier votre connexion Internet et réessayer.";
            break;
          default:
            errorMessage = `Une erreur est survenue (code: ${authError.code}). Veuillez contacter le support si le problème persiste.`;
            break;
        }
      } else {
        errorMessage = (error as Error).message || "Une erreur inconnue est survenue lors de la tentative de connexion.";
      }
      
      toast({
        variant: "destructive",
        title: "Erreur d'authentification",
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit, onValidationErrors)} className="flex flex-col space-y-4">
        {mode === 'signup' && (
          <FormField
            control={form.control}
            name="displayName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nom d'utilisateur</FormLabel>
                <FormControl>
                  <Input placeholder="Votre nom" {...field} autoComplete="name" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input placeholder="votre@email.com" {...field} autoComplete="email" />
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
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground"
                    aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {mode === 'login' && (
          <FormField
            control={form.control}
            name="rememberMe"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>
                    Se souvenir de moi
                  </FormLabel>
                </div>
              </FormItem>
            )}
          />
        )}
        
        <FormField
          control={form.control}
          name="token"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Jeton d'accès (Optionnel)</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input placeholder="LBN-XXXX-XXXX" {...field} autoComplete="off" className="pl-10 font-mono tracking-wider" />
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                    <Ticket className="h-5 w-5" />
                  </div>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {mode === 'signup' && (
          <FormField
            control={form.control}
            name="acceptCgv"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0 pt-2">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel className="text-xs">
                    J'ai lu et j'accepte les{' '}
                    <Dialog>
                      <DialogTrigger asChild>
                        <button type="button" className="text-primary font-bold hover:underline underline-offset-4">
                          Conditions Générales de Vente
                        </button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col p-0 overflow-hidden">
                        <DialogHeader className="p-6 bg-muted/30 border-b">
                          <DialogTitle className="flex items-center gap-2 font-black uppercase tracking-tighter">
                            <ScrollText className="size-5 text-primary" /> Conditions Générales de Vente
                          </DialogTitle>
                        </DialogHeader>
                        <ScrollArea className="flex-1 p-6">
                          <div className="prose prose-sm font-medium leading-relaxed text-muted-foreground whitespace-pre-wrap">
                            {cgvData?.content || "Les conditions générales sont en cours de mise à jour. Veuillez réessayer plus tard."}
                          </div>
                        </ScrollArea>
                        <DialogFooter className="p-4 border-t bg-muted/10">
                          <DialogClose asChild>
                            <Button variant="default" className="w-full font-black uppercase">Compris</Button>
                          </DialogClose>
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
            className="w-full h-12 font-black uppercase tracking-widest shadow-md" 
            disabled={isLoading || (mode === 'signup' && !form.getValues('acceptCgv'))}
          >
            {isLoading ? "Chargement..." : (mode === 'login' ? 'Se connecter' : "S'inscrire")}
          </Button>
        </div>
      </form>
    </Form>
  );
}
