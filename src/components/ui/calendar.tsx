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
    <div className="relative overflow-hidden rounded-[2.5rem] p-1 bg-white shadow-2xl border-2 border-primary/5">
      <DayPicker
        locale={fr}
        weekStartsOn={1}
        showOutsideDays={showOutsideDays}
        className={cn("p-4", className)}
        classNames={{
          months: "flex flex-col space-y-4",
          month: "space-y-4",
          caption: "flex justify-center pt-1 relative items-center mb-6",
          caption_label: "text-base font-black uppercase tracking-tighter text-primary bg-primary/5 px-6 py-2 rounded-full",
          nav: "flex items-center",
          nav_button: cn(
            buttonVariants({ variant: "outline" }),
            "h-10 w-10 bg-white p-0 opacity-100 hover:bg-primary/10 border-2 border-primary/10 text-primary transition-all active:scale-75 rounded-full shadow-sm"
          ),
          nav_button_previous: "absolute left-0",
          nav_button_next: "absolute right-0",
          table: "w-full border-collapse",
          head_row: "grid grid-cols-7 w-full mb-4",
          head_cell: "text-muted-foreground font-black text-[10px] uppercase tracking-tighter text-center flex items-center justify-center h-8 [&:nth-child(6)]:text-primary/60 [&:nth-child(7)]:text-primary/60",
          row: "grid grid-cols-7 w-full mt-1",
          cell: "h-11 flex items-center justify-center p-0 relative focus-within:relative focus-within:z-20",
          day: cn(
            buttonVariants({ variant: "ghost" }),
            "h-10 w-10 p-0 font-bold aria-selected:opacity-100 hover:bg-primary/10 hover:text-primary rounded-2xl transition-all active:scale-90 text-sm"
          ),
          day_selected:
            "bg-accent text-accent-foreground hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground rounded-2xl shadow-[0_8px_20px_-4px_rgba(230,126,34,0.6)] ring-2 ring-accent ring-offset-2 scale-110 z-10 font-black",
          day_today: "bg-primary/10 text-primary ring-2 ring-inset ring-primary/30 rounded-2xl font-black relative after:content-[''] after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:size-1 after:bg-primary after:rounded-full",
          day_outside: "text-muted-foreground opacity-20",
          day_disabled: "text-muted-foreground opacity-50",
          day_hidden: "invisible",
          ...classNames,
        }}
        formatters={{
          formatWeekdayName: (date) => format(date, 'EEE', { locale: fr }).substring(0, 3).toUpperCase(),
        }}
        components={{
          IconLeft: ({ ...props }) => <ChevronLeft className="h-5 w-5" />,
          IconRight: ({ ...props }) => <ChevronRight className="h-5 w-5" />,
        }}
        {...props}
      />
    </div>
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
