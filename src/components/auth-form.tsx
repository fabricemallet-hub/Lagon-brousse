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
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, AuthError } from 'firebase/auth';

const formSchema = z.object({
  email: z.string().email({ message: 'Veuillez entrer une adresse email valide.' }),
  password: z.string().min(6, { message: 'Le mot de passe doit contenir au moins 6 caractères.' }),
});

type AuthFormProps = {
  mode: 'login' | 'signup';
};

export function AuthForm({ mode }: AuthFormProps) {
  const auth = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    if (!auth) {
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
        await signInWithEmailAndPassword(auth, values.email, values.password);
      } else {
        await createUserWithEmailAndPassword(auth, values.email, values.password);
      }
      toast({
        title: mode === 'login' ? 'Connexion réussie!' : 'Inscription réussie!',
        description: "Vous allez être redirigé vers la page d'accueil.",
      });
      router.push('/');
    } catch (error) {
      console.error("Authentication Error:", error); // Log the full error for debugging
      const authError = error as AuthError;
      let errorMessage = "Une erreur est survenue lors de l'authentification.";

      // Handle specific Firebase Auth error codes
      switch (authError.code) {
        case 'auth/invalid-credential':
          errorMessage = 'Email ou mot de passe incorrect. Veuillez vérifier vos informations et réessayer.';
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
          errorMessage = "Un problème est survenu. Veuillez réessayer plus tard ou contacter le support si le problème persiste.";
          break;
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
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
              <FormLabel>Mot de passe</FormLabel>
              <FormControl>
                <Input type="password" placeholder="********" {...field} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? "Chargement..." : (mode === 'login' ? 'Se connecter' : "S'inscrire")}
        </Button>
      </form>
    </Form>
  );
}
