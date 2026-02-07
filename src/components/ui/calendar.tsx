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
    <div className="relative overflow-hidden rounded-[2rem] p-1 bg-gradient-to-br from-primary/5 to-accent/5">
      {/* Éléments décoratifs en arrière-plan */}
      <div className="absolute -top-12 -right-12 size-40 bg-accent/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-12 -left-12 size-40 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      
      <DayPicker
        locale={fr}
        weekStartsOn={1}
        showOutsideDays={showOutsideDays}
        className={cn("p-5 bg-card border-2 border-primary/10 shadow-2xl relative z-10 rounded-[1.8rem]", className)}
        classNames={{
          months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
          month: "space-y-6 relative w-full",
          caption: "flex justify-center pt-2 relative items-center mb-4",
          caption_label: "text-lg font-black uppercase tracking-tighter text-primary bg-primary/5 px-5 py-1.5 rounded-full shadow-inner",
          nav: "flex items-center",
          nav_button: cn(
            buttonVariants({ variant: "outline" }),
            "h-10 w-10 bg-background/80 backdrop-blur-md p-0 opacity-100 hover:bg-primary/10 border-2 border-primary/20 text-primary transition-all active:scale-75 rounded-full shadow-sm"
          ),
          nav_button_previous: "absolute left-1",
          nav_button_next: "absolute right-1",
          table: "w-full border-collapse",
          head_row: "flex w-full mb-2 justify-between",
          head_cell:
            "text-muted-foreground font-black text-[10px] uppercase tracking-tight text-center w-11 h-9 flex items-center justify-center opacity-60 [&:nth-child(6)]:text-primary/80 [&:nth-child(7)]:text-primary/80",
          row: "flex w-full mt-2 justify-between",
          cell: "h-12 w-11 text-center text-sm p-0 relative flex items-center justify-center focus-within:relative focus-within:z-20",
          day: cn(
            buttonVariants({ variant: "ghost" }),
            "h-11 w-11 p-0 font-bold aria-selected:opacity-100 hover:bg-primary/10 hover:text-primary rounded-2xl transition-all active:scale-90"
          ),
          day_selected:
            "bg-accent text-accent-foreground hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground rounded-2xl shadow-[0_8px_20px_-4px_rgba(230,126,34,0.6)] ring-2 ring-accent ring-offset-2 scale-110 z-10 font-black",
          day_today: "bg-primary/10 text-primary ring-2 ring-inset ring-primary/30 rounded-2xl font-black relative after:content-[''] after:absolute after:bottom-1.5 after:left-1/2 after:-translate-x-1/2 after:size-1 after:bg-primary after:rounded-full",
          day_outside:
            "day-outside text-muted-foreground opacity-20 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
          day_disabled: "text-muted-foreground opacity-50",
          day_range_middle:
            "aria-selected:bg-accent aria-selected:text-accent-foreground",
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