"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"
import { fr } from "date-fns/locale"
import { format } from "date-fns"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

/**
 * Composant Calendrier optimisé pour react-day-picker v9.
 * Utilise des classes de grille forcées pour un alignement parfait sur mobile.
 */
function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <div className="relative overflow-hidden rounded-[2.5rem] p-1 bg-white shadow-2xl border-2 border-primary/10 mx-auto w-fit">
      <DayPicker
        locale={fr}
        weekStartsOn={1}
        showOutsideDays={showOutsideDays}
        className={cn("p-4", className)}
        classNames={{
          // --- STRUCTURE GLOBALE ---
          months: "flex flex-col space-y-4",
          month: "space-y-6 w-full",
          
          // --- EN-TÊTE (MOIS ET NAVIGATION) ---
          month_caption: "flex justify-between items-center h-12 relative px-2 mb-4",
          caption_label: "text-sm font-black uppercase tracking-tighter text-primary bg-primary/5 px-5 py-2 rounded-full shadow-inner",
          nav: "flex items-center gap-1",
          button_previous: cn(
            buttonVariants({ variant: "outline" }),
            "h-10 w-10 bg-white p-0 opacity-100 hover:bg-primary/10 border-2 border-primary/10 text-primary transition-all active:scale-75 rounded-full shadow-sm absolute left-0 z-10"
          ),
          button_next: cn(
            buttonVariants({ variant: "outline" }),
            "h-10 w-10 bg-white p-0 opacity-100 hover:bg-primary/10 border-2 border-primary/10 text-primary transition-all active:scale-75 rounded-full shadow-sm absolute right-0 z-10"
          ),

          // --- GRILLE DES JOURS (FORCE L'ALIGNEMENT) ---
          month_grid: "w-full flex flex-col gap-2",
          weeks: "flex flex-col gap-1.5",
          week: "flex w-full items-center justify-between gap-1", // Force chaque ligne à être une boîte flex
          
          // --- JOURS DE LA SEMAINE (LUN, MAR...) ---
          weekdays: "flex w-full border-b border-dashed border-primary/10 pb-2 mb-1",
          weekday: "text-muted-foreground font-black text-[10px] uppercase tracking-tighter text-center flex-1 h-8 flex items-center justify-center [&:nth-child(6)]:text-primary [&:nth-child(7)]:text-primary",
          
          // --- CELLULES DE JOUR ---
          day: cn(
            "h-11 w-11 p-0 flex-1 flex items-center justify-center font-bold rounded-2xl transition-all active:scale-90 text-sm border-2 border-transparent relative hover:bg-primary/10 hover:text-primary"
          ),
          day_button: "size-full flex items-center justify-center",
          
          // --- ÉTATS SPÉCIFIQUES ---
          selected: cn(
            "!bg-accent !text-accent-foreground rounded-2xl shadow-[0_8px_20px_-4px_rgba(230,126,34,0.6)] ring-2 ring-accent ring-offset-2 scale-110 z-10 font-black !border-white"
          ),
          today: "text-primary ring-2 ring-inset ring-primary/30 rounded-2xl font-black after:content-[''] after:absolute after:bottom-1.5 after:left-1/2 after:-translate-x-1/2 after:size-1 after:bg-primary after:rounded-full",
          outside: "text-muted-foreground opacity-20 pointer-events-none",
          disabled: "text-muted-foreground opacity-50",
          hidden: "invisible",
          ...classNames,
        }}
        formatters={{
          formatWeekdayName: (date) => format(date, 'EEE', { locale: fr }).substring(0, 3).toUpperCase(),
        }}
        components={{
          Chevron: (props) => {
            if (props.orientation === 'left') return <ChevronLeft className="size-6" />;
            return <ChevronRight className="size-6" />;
          }
        }}
        {...props}
      />
    </div>
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
