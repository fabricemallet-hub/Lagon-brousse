"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"
import { fr } from "date-fns/locale"
import { format } from "date-fns"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <div className="relative overflow-hidden rounded-[2.5rem] p-1 bg-white shadow-2xl border-2 border-primary/10">
      <DayPicker
        locale={fr}
        weekStartsOn={1}
        showOutsideDays={showOutsideDays}
        className={cn("p-4", className)}
        classNames={{
          months: "flex flex-col space-y-4",
          month: "space-y-6 w-full",
          // Positionnement des flèches et du titre
          caption: "flex justify-between items-center h-12 relative px-2 mb-4",
          caption_label: "text-sm font-black uppercase tracking-tighter text-primary bg-primary/5 px-5 py-2 rounded-full shadow-inner",
          nav: "flex items-center gap-1",
          nav_button: cn(
            buttonVariants({ variant: "outline" }),
            "h-10 w-10 bg-white p-0 opacity-100 hover:bg-primary/10 border-2 border-primary/10 text-primary transition-all active:scale-75 rounded-full shadow-sm"
          ),
          nav_button_previous: "absolute left-0",
          nav_button_next: "absolute right-0",
          // Forçage de la grille pour corriger l'alignement des colonnes
          table: "w-full flex flex-col gap-2",
          head_row: "flex w-full border-b border-dashed border-primary/10 pb-2",
          head_cell: "text-muted-foreground font-black text-[10px] uppercase tracking-tighter text-center flex-1 h-8 flex items-center justify-center [&:nth-child(6)]:text-primary [&:nth-child(7)]:text-primary",
          row: "flex w-full mt-1",
          cell: "h-12 flex-1 flex items-center justify-center p-0 relative focus-within:relative focus-within:z-20",
          day: cn(
            buttonVariants({ variant: "ghost" }),
            "h-11 w-11 p-0 font-bold aria-selected:opacity-100 hover:bg-primary/10 hover:text-primary rounded-2xl transition-all active:scale-90 text-sm border-2 border-transparent"
          ),
          day_selected:
            "bg-accent text-accent-foreground hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground rounded-2xl shadow-[0_8px_20px_-4px_rgba(230,126,34,0.6)] ring-2 ring-accent ring-offset-2 scale-110 z-10 font-black border-white",
          day_today: "text-primary ring-2 ring-inset ring-primary/30 rounded-2xl font-black relative after:content-[''] after:absolute after:bottom-1.5 after:left-1/2 after:-translate-x-1/2 after:size-1 after:bg-primary after:rounded-full",
          day_outside: "text-muted-foreground opacity-20 pointer-events-none",
          day_disabled: "text-muted-foreground opacity-50",
          day_hidden: "invisible",
          ...classNames,
        }}
        formatters={{
          formatWeekdayName: (date) => format(date, 'EEE', { locale: fr }).substring(0, 3).toUpperCase(),
        }}
        components={{
          IconLeft: ({ ...props }) => <ChevronLeft className="h-6 w-6" />,
          IconRight: ({ ...props }) => <ChevronRight className="h-6 w-6" />,
        }}
        {...props}
      />
    </div>
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
