import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getTodaysData } from '@/lib/data';
import {
  Moon,
  Spade,
  Scissors,
  Flower,
  Carrot,
  Leaf,
  RefreshCw,
  Info
} from 'lucide-react';
import type { LucideProps } from 'lucide-react';

const icons: { [key: string]: React.FC<LucideProps> } = {
  Spade,
  Scissors,
  Flower,
  Carrot,
  Leaf,
  RefreshCw,
};

export default function ChampsPage() {
  const { farming } = getTodaysData('Koné');

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Calendrier du Jardinier</CardTitle>
          <CardDescription>
            Que faire au jardin aujourd'hui selon la lune ?
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-lg bg-muted/50">
            <div className="space-y-1">
              <h3 className="font-semibold">Phase Actuelle</h3>
              <p className="flex items-center gap-2 text-primary font-bold text-lg">
                <Moon />
                {farming.lunarPhase}
              </p>
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold">Influence du Zodiaque</h3>
              <p className="text-lg font-bold">Jour {farming.zodiac}</p>
            </div>
          </div>
          <div className="space-y-2 pt-4">
            <div className="flex items-center gap-2 text-lg font-semibold">
                <Info className="size-5 text-accent" />
                <span>Recommandation générale</span>
            </div>
            <p className="text-muted-foreground">
                {farming.recommendation}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Tâches recommandées</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {farming.details.map((item, index) => {
            const Icon = icons[item.icon];
            return (
              <Card key={index}>
                <CardHeader className="flex flex-row items-center gap-4 space-y-0 pb-2">
                  <div className="p-3 rounded-full bg-primary/10 text-primary">
                    {Icon && <Icon className="size-6" />}
                  </div>
                  <CardTitle>{item.task}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {item.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
