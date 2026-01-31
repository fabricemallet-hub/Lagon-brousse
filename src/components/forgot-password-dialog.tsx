'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
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
import { sendPasswordResetEmail } from 'firebase/auth';

const formSchema = z.object({
  email: z.string().email({ message: 'Veuillez entrer une adresse email valide.' }),
});

export function ForgotPasswordDialog() {
  const auth = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    if (!auth) {
      toast({
        variant: 'destructive',
        title: "Erreur d'initialisation",
        description: "Le service d'authentification n'est pas disponible.",
      });
      setIsLoading(false);
      return;
    }

    try {
      await sendPasswordResetEmail(auth, values.email);
      toast({
        title: 'Email envoyé !',
        description: 'Un lien de réinitialisation de mot de passe a été envoyé à votre adresse email.',
      });
      setIsOpen(false); // Close the dialog on success
      form.reset();
    } catch (error) {
      console.error('Password Reset Error:', error);
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible d\'envoyer l\'email. Vérifiez que l\'adresse est correcte ou réessayez plus tard.',
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <button type="button" className="text-sm text-primary hover:underline self-end">
          Mot de passe oublié ?
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Réinitialiser le mot de passe</DialogTitle>
          <DialogDescription>
            Entrez votre adresse email pour recevoir un lien de réinitialisation.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
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
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="secondary">
                  Annuler
                </Button>
              </DialogClose>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Envoi en cours...' : 'Envoyer le lien'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
