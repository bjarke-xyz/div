import { cityUrls } from "../../lib/va/city-urls";

export const onRequest: PagesFunction = async () => {
  const cities = Object.keys(cityUrls.DMI).map((city) => {
    const firstLetterUpper = city[0].toUpperCase();
    return `${firstLetterUpper}${city.slice(1).toLowerCase()}`;
  });
  return new Response(JSON.stringify(cities), {
    headers: {
      "Content-Type": "application/json",
    },
  });
};
