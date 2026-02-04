
'use client';

import React from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import type { SplashScreenSettings } from '@/lib/types';

interface SplashScreenProps {
  settings: SplashScreenSettings;
  isExiting?: boolean;
}

export function SplashScreen({ settings, isExiting }: SplashScreenProps) {
  const {
    splashMode = 'text',
    splashText = 'Lagon & Brousse NC',
    splashTextColor = '#ffffff',
    splashFontSize = '32',
    splashBgColor = '#3b82f6',
    splashImageUrl = '',
    splashImageFit = 'contain',
  } = settings;

  return (
    <div
      className={cn(
        "fixed inset-0 z-[9999] flex items-center justify-center transition-opacity duration-1000 ease-in-out",
        isExiting ? "opacity-0 pointer-events-none" : "opacity-100"
      )}
      style={{ backgroundColor: splashBgColor }}
    >
      <div className="relative w-full h-full flex items-center justify-center p-8">
        {splashMode === 'text' ? (
          <h1
            className="font-bold text-center animate-in fade-in zoom-in duration-1000 px-4 leading-tight"
            style={{
              color: splashTextColor,
              fontSize: `${splashFontSize}px`,
              textShadow: '0 2px 10px rgba(0,0,0,0.5), 0 0 20px rgba(0,0,0,0.3)',
            }}
          >
            {splashText}
          </h1>
        ) : (
          <div className="relative w-full h-full max-w-[90%] max-h-[80%] animate-in fade-in zoom-in duration-1000">
            {splashImageUrl ? (
              <Image
                src={splashImageUrl}
                alt="Splash Logo"
                fill
                className={cn(
                  "transition-all",
                  splashImageFit === 'cover' ? "object-cover" : "object-contain"
                )}
                sizes="100vw"
                priority
              />
            ) : (
              <div className="flex flex-col items-center gap-4 text-white/50">
                <p>Aucune image configurée</p>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Simple pulse loading indicator at the bottom */}
      <div className="absolute bottom-12 left-1/2 -translate-x-1/2">
        <div className="flex gap-1.5">
          <div className="size-2 rounded-full bg-white/40 animate-pulse"></div>
          <div className="size-2 rounded-full bg-white/40 animate-pulse delay-150"></div>
          <div className="size-2 rounded-full bg-white/40 animate-pulse delay-300"></div>
        </div>
      </div>
    </div>
  );
}
