import { useEffect, useState } from "react";
import { DayEvent } from "../lib/models";

interface EventWrapperProps {
  events: DayEvent[];
  date: Date;
}
export const EventWrapper: React.FC<EventWrapperProps> = ({ events, date }) => {
  return (
    <div>
      {events.map((event) => (
        <div className="mb-5" key={event.event}>
          <Event date={date} event={event} />
        </div>
      ))}
    </div>
  );
};

interface EventProps {
  event: DayEvent;
  date: Date;
}
export const Event: React.FC<EventProps> = ({ event }) => {
  // let imageUrl = "";
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  // let imageUrl = event.imageUrl ?? null;
  const originalImageUrl = event.imageUrl ?? null;
  useEffect(() => {
    if (event.imageUrl) {
      let tmpUrl = event.imageUrl;
      if (tmpUrl.includes("/thumb/")) {
        tmpUrl = tmpUrl.replace("/thumb", "");
        const pathParts = tmpUrl.split("/");
        const lastPart = pathParts[pathParts.length - 1];
        tmpUrl = tmpUrl.replace(`/${lastPart}`, "");
        setImageUrl(tmpUrl);
        // imageUrl = tmpUrl;
      }
    }
  }, [event.imageUrl]);

  function imageUrlFallback() {
    if (imageUrl !== originalImageUrl) {
      setImageUrl(originalImageUrl);
      // imageUrl = originalImageUrl;
    }
  }

  return (
    <div>
      <div className="text-3xl">
        {event.event} <span className="text-base">({event.country})</span>
      </div>
      {/* <time>{format(eventDate, "E d MMM")}</time> */}
      <p>{event.details}</p>
      {imageUrl && <img onError={imageUrlFallback} src={imageUrl}></img>}
    </div>
  );
};
