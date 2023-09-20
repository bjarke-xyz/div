import useSWR from "swr";
import { WeatherPage } from "./components/WeatherPage";
import { fetcher } from "../utils/fetcher";
import { useEffect, useState } from "react";

export const App = () => {
  const {
    data: cities,
    error,
    isLoading,
  } = useSWR<string[]>(`/api/va/cities`, fetcher);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedCity && cities) {
      setSelectedCity(cities[0]);
    }
  }, [cities, selectedCity]);
  if (isLoading) return <p>Loading...</p>;
  if (error) return <p>error: {error}</p>;
  if (!cities) return <p>no data?</p>;
  return (
    <div className="flex flex-col items-center">
      {selectedCity && (
        <>
          <WeatherPage city={selectedCity} />
          <div className="flex flex-row gap-4 mt-4">
            {cities.map((city) => (
              <button
                key={city}
                title={city}
                onClick={() => setSelectedCity(city)}
                className={`${
                  city === selectedCity ? "bg-blue-200" : "bg-blue-50"
                } h-16 w-16 text-3xl rounded-md hover:bg-blue-200`}
              >
                <span>&bull;</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
