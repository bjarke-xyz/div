import { addDays, endOfYear, format, startOfYear } from "date-fns";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { DayEvent } from "../lib/models";

function formatDate(date: Date): string {
  return format(date, "dd-MM-yyyy");
}

export interface EventCalendarProps {
  date: Date;
  setDate: (date: Date) => void;
  onMonthChange: (date: Date) => void;
  events: DayEvent[] | null;
}
export const EventCalendar: React.FC<EventCalendarProps> = ({
  date,
  setDate,
  onMonthChange,
  events,
}) => {
  const eventDates = (events ?? []).map((x) => x.date);
  const eventDatesSet = new Set<string>(
    eventDates.map((x) => format(x as Date, "MM-dd"))
  );
  const eventsMap = new Map<string, DayEvent[]>();
  for (const event of events ?? []) {
    if (eventsMap.has(formatDate(event.date as Date))) {
      eventsMap.get(formatDate(event.date as Date))?.push(event);
    } else {
      eventsMap.set(formatDate(event.date as Date), [event]);
    }
  }
  const disabledDates: Date[] = [];
  const startDate = startOfYear(date);
  const endDate = endOfYear(date);
  for (let d = startDate; d <= endDate; d = addDays(d, 1)) {
    if (!eventDatesSet.has(format(d, "MM-dd"))) {
      disabledDates.push(d);
    }
  }
  return (
    <DayPicker
      mode="single"
      selected={date}
      onSelect={(d) => setDate(d ?? new Date())}
      fromYear={date.getFullYear()}
      toYear={date.getFullYear()}
      onMonthChange={(d) => onMonthChange(d)}
      disabled={disabledDates}
      weekStartsOn={1}
      onDayMouseEnter={(e, _modifiers, mouseEvent) => {
        const events = eventsMap.get(formatDate(e));
        const eventTitles = events?.map((x) => x.event)?.join(", ");
        const target = mouseEvent.target as HTMLElement;
        if (eventTitles) {
          target.title = eventTitles;
        }
      }}
      // modifiers={{ eventDay: eventDates }}
      // modifiersClassNames={{
      //   eventDay: "!bg-blue-200 !text-extrabold !text-lg !text-black",
      // }}
    />
  );
};
