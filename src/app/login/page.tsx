'use client';
import { AuthForm } from '@/components/auth-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

export default function LoginPage() {
  const { toast } = useToast();

  const handleSubscribe = () => {
    const paypalLink = process.env.NEXT_PUBLIC_PAYPAL_LINK;
    if (paypalLink) {
      window.open(paypalLink, '_blank');
    } else {
      toast({ 
        variant: "destructive", 
        title: "Erreur", 
        description: "Le lien d'abonnement n'est pas encore configuré." 
      });
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-200px)] p-4">
      <Card className="w-full max-w-sm mx-auto shadow-xl border-2">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-black uppercase tracking-tighter text-center">Connexion</CardTitle>
          <CardDescription className="text-center text-xs">
            Accédez à votre compte Lagon & Brousse NC.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <AuthForm mode="login" />
          
          <div className="space-y-4 pt-2">
            <p className="text-center text-sm text-muted-foreground">
              Pas encore de compte ?{' '}
              <Link href="/signup" className="underline font-bold text-primary hover:text-primary/90">
                Créer un compte
              </Link>
            </p>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase font-black tracking-widest">
                <span className="bg-background px-2 text-muted-foreground">Accès Premium</span>
              </div>
            </div>

            <Button 
              variant="default" 
              className="w-full h-14 font-black uppercase tracking-widest shadow-lg text-sm bg-primary hover:bg-primary/90 transition-all active:scale-[0.98]"
              onClick={handleSubscribe}
            >
              S'abonner (4.19€ / mois)
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
