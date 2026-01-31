'use client';
import { AuthForm } from '@/components/auth-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

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
