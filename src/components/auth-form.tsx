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
import { useAuth } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  updateProfile, 
  AuthError,
} from 'firebase/auth';
import { ForgotPasswordDialog } from './forgot-password-dialog';
import { Eye, EyeOff } from 'lucide-react';

type AuthFormProps = {
  mode: 'login' | 'signup';
};

const formSchema = (mode: AuthFormProps['mode']) => z.object({
  displayName: z.string().min(3, { message: 'Le nom doit contenir au moins 3 caractères.' }).optional(),
  email: z.string().email({ message: 'Veuillez entrer une adresse email valide.' }),
  password: z.string().min(6, { message: 'Le mot de passe doit contenir au moins 6 caractères.' }),
}).refine(data => mode !== 'signup' || (!!data.displayName && data.displayName.length > 0), {
    message: "Le nom d'utilisateur est requis.",
    path: ["displayName"],
});


export function AuthForm({ mode }: AuthFormProps) {
  const auth = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  console.log(`--- [AuthForm] Rendering. Mode: ${mode}, IsLoading: ${isLoading} ---`);

  const form = useForm<z.infer<ReturnType<typeof formSchema>>>({
    resolver: zodResolver(formSchema(mode)),
    defaultValues: {
      displayName: '',
      email: '',
      password: '',
    },
  });

  async function onSubmit(values: z.infer<ReturnType<typeof formSchema>>) {
    console.log('--- [AuthForm] onSubmit started. ---', values);
    setIsLoading(true);

    if (!auth) {
      console.error("--- [AuthForm] Auth service is not available. ---");
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
        console.log('--- [AuthForm] Calling signInWithEmailAndPassword with:', values.email);
        await signInWithEmailAndPassword(auth, values.email, values.password);
        console.log('--- [AuthForm] signInWithEmailAndPassword SUCCESS. ---');
        toast({
            title: 'Connexion réussie!',
            description: "Vous allez être redirigé vers la page d'accueil.",
        });
        router.push('/');
      } else {
        console.log('--- [AuthForm] Calling createUserWithEmailAndPassword... ---');
        const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
        if (values.displayName) {
            console.log('--- [AuthForm] Calling updateProfile... ---');
            await updateProfile(userCredential.user, {
                displayName: values.displayName
            });
        }
        console.log('--- [AuthForm] Sign up SUCCESS. ---');
        toast({
          title: 'Inscription réussie!',
          description: "Vous allez être redirigé vers la page d'accueil.",
        });
        router.push('/');
      }
    } catch (error) {
      const authError = error as AuthError;
      console.error("--- [AuthForm] Authentication failed. ---", authError);

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
      console.log('--- [AuthForm] onSubmit finished. ---');
      setIsLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col space-y-4">
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
        
        <div className="pt-4">
          <Button 
            type="submit" 
            className="w-full" 
            disabled={isLoading}
            onClick={() => console.log('--- [AuthForm] Login button clicked. ---')}
          >
            {isLoading ? "Chargement..." : (mode === 'login' ? 'Se connecter' : "S'inscrire")}
          </Button>
        </div>
      </form>
    </Form>
  );
}
