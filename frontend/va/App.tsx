import useSWR from "swr";
import { WeatherPage } from "./components/WeatherPage";
import { fetcher } from "../lib/fetcher";
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
    <div className="flex flex-col items-center min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 pb-8">
      {selectedCity && (
        <>
          <WeatherPage city={selectedCity} />
          <div className="flex flex-row gap-3 mt-8">
            {cities.map((city) => (
              <button
                key={city}
                title={city}
                onClick={() => setSelectedCity(city)}
                className={`${
                  city === selectedCity
                    ? "bg-slate-700 text-white shadow-lg"
                    : "bg-white text-slate-500 shadow-md"
                } h-14 w-14 text-2xl rounded-full hover:bg-slate-600 hover:text-white transition-all duration-200 border border-slate-300`}
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
