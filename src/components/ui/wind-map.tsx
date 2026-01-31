'use client';

import { ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WindDirection } from '@/lib/types';

const directionToRotation: Record<WindDirection, number> = {
  N: 0,
  NE: 45,
  E: 90,
  SE: 135,
  S: 180,
  SW: 225,
  W: 270,
  NW: 315,
};

const NewCaledoniaMap = () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 250"
      className="w-full h-full"
      fill="currentColor"
    >
      <path d="M63.3,1.3c-2.1-1.8-5.3-1.8-7.4,0C46,10.2,40.1,23.3,37.3,34c-1.3,4.9-2.3,9.9-3,14.9c-2.3,16.5-2.7,33.2-1,49.7 c1.2,11.5,2.6,22.9,4.4,34.3c1.7,10.8,3.5,21.5,5.1,32.3c1.9,12.7,3.3,25.4,3.3,38.2c0,3.3-0.2,6.5-0.6,9.8 c-0.6,5.1-1.2,10.1-1.8,15.2c-0.2,1.8-0.3,3.5-0.5,5.3c-0.1,1.1-0.2,2.2-0.2,3.3c-0.1,1.8-0.8,3.4-2.1,4.4c-2,1.5-4.7,1.1-6.2-0.9 c-1.2-1.6-1.5-3.6-0.8-5.4c1.1-3,2.4-5.9,3.6-8.9c1.4-3.5,2.6-7,3.5-10.6c1.1-4.2,1.7-8.5,1.7-12.8c0-13.8-1.5-27.4-3.6-40.9 c-1.7-11.1-3.6-22.1-5.4-33.2c-1.9-11.8-3.3-23.7-4.6-35.6c-1.8-16.9-1.4-34.1,1.1-51c0.7-5.1,1.7-10.2,3.1-15.1 c2.8-9.8,8.2-19.1,16.9-26.6C60,2,61.9,1.8,63.3,1.3z" />
    </svg>
);

export const WindMap = ({
  direction,
  className,
}: {
  direction: WindDirection;
  className?: string;
}) => {
  const rotation = directionToRotation[direction] || 0;
  return (
    <div className={cn('relative w-24 h-48', className)}>
      <div className="absolute inset-0 text-muted-foreground/30">
        <NewCaledoniaMap />
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <ArrowUp
          className="h-12 w-12 text-primary drop-shadow-md"
          style={{ transform: `rotate(${rotation}deg)` }}
        />
      </div>
    </div>
  );
};
