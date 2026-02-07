'use client';
import { AuthForm } from '@/components/auth-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Landmark, CreditCard, Download, ExternalLink } from 'lucide-react';

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

  const handlePaypalDonate = () => {
    // Lien de paiement PayPal spécifique fourni par l'utilisateur
    const donationLink = "https://www.paypal.com/ncp/payment/G5GSMQHE3P6NA";
    window.open(donationLink, '_blank');
  };

  const handleDownloadRib = () => {
    window.open('/RIB_Lagon_Brousse_NC.pdf', '_blank');
    toast({
      title: "Téléchargement lancé",
      description: "Le RIB de Lagon & Brousse est en cours d'ouverture."
    });
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
                <span className="bg-background px-2 text-muted-foreground">Soutien & Premium</span>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <Button 
                variant="default" 
                className="w-full h-14 font-black uppercase tracking-widest shadow-lg text-sm bg-primary hover:bg-primary/90 transition-all active:scale-[0.98]"
                onClick={handleSubscribe}
              >
                S'abonner (4.19€ / mois)
              </Button>
              
              <Dialog>
                <DialogTrigger asChild>
                  <Button 
                    variant="default" 
                    className="w-full h-14 font-black uppercase tracking-widest shadow-lg text-sm bg-accent hover:bg-accent/90 transition-all active:scale-[0.98]"
                  >
                    DONS
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-xs rounded-2xl">
                  <DialogHeader>
                    <DialogTitle className="font-black uppercase tracking-tighter text-center">Soutenir le projet</DialogTitle>
                    <DialogDescription className="text-center text-[10px] uppercase font-bold">Choisissez votre mode de contribution</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <Button 
                      variant="outline" 
                      className="h-16 flex flex-col items-center justify-center gap-1 border-2 hover:bg-primary/5"
                      onClick={handleDownloadRib}
                    >
                      <div className="flex items-center gap-2 text-xs font-black uppercase">
                        <Landmark className="size-4 text-primary" /> Virement Bancaire
                      </div>
                      <span className="text-[8px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                        <Download className="size-2" /> Télécharger mon RIB
                      </span>
                    </Button>

                    <Button 
                      variant="outline" 
                      className="h-16 flex flex-col items-center justify-center gap-1 border-2 hover:bg-accent/5"
                      onClick={handlePaypalDonate}
                    >
                      <div className="flex items-center gap-2 text-xs font-black uppercase">
                        <CreditCard className="size-4 text-accent" /> PayPal
                      </div>
                      <span className="text-[8px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                        <ExternalLink className="size-2" /> Montant libre
                      </span>
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
