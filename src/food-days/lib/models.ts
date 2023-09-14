export interface DayEvent {
  date: Date | string;
  event: string;
  details?: string;
  imageUrl?: string;
  country: string;
}
