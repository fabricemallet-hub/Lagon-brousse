'use client';
import { AuthForm } from '@/components/auth-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

export default function SignupPage() {
  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
      <Card className="w-full max-w-sm mx-auto">
        <CardHeader>
          <CardTitle>Inscription</CardTitle>
          <CardDescription>Créez votre compte pour sauvegarder vos préférences et utiliser les fonctionnalités de partage.</CardDescription>
        </CardHeader>
        <CardContent>
          <AuthForm mode="signup" />
           <p className="mt-4 text-center text-sm">
            Déjà un compte ?{' '}
            <Link href="/login" className="underline">
              Se connecter
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
