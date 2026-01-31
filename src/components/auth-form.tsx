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
      const authError = error as AuthError;
      let errorMessage = "Une erreur est survenue.";
      switch (authError.code) {
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
          errorMessage = 'Email ou mot de passe incorrect.';
          break;
        case 'auth/email-already-in-use':
          errorMessage = 'Cette adresse email est déjà utilisée.';
          break;
        case 'auth/weak-password':
          errorMessage = 'Le mot de passe est trop faible.';
          break;
        default:
          errorMessage = "Une erreur inconnue est survenue. Veuillez réessayer.";
          console.error(authError.message);
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
                <Input placeholder="votre@email.com" {...field} />
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
                <Input type="password" placeholder="********" {...field} />
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
