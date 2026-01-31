'use client';
import { AuthForm } from '@/components/auth-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Fingerprint } from 'lucide-react';

export default function LoginPage() {
  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
      <Card className="w-full max-w-sm mx-auto">
        <CardHeader>
          <CardTitle>Connexion</CardTitle>
          <CardDescription>Accédez à votre compte pour profiter de toutes les fonctionnalités.</CardDescription>
        </CardHeader>
        <CardContent>
          <AuthForm mode="login" />
          
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">
                Ou
              </span>
            </div>
          </div>
          
          <Button variant="outline" className="w-full" disabled>
            <Fingerprint className="mr-2 h-4 w-4" />
            Se connecter avec la biométrie
          </Button>

          <p className="mt-4 text-center text-sm">
            Pas encore de compte ?{' '}
            <Link href="/signup" className="underline">
              S'inscrire
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
