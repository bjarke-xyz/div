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
      <WeatherPage city={selectedCity!} />
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
    </div>
  );
};

// const fetcher = <T>(...args: unknown[]) => fetch.apply(null, args as any).then(res => res.json() as T)

// async function fetchWeatherData(
//   city: string
// ): Promise<WeatherForecastResponse> {
//   const resp = await fetch(`/api/va/weather?city=${city}`);
//   const body: WeatherForecastResponse = await resp.json();
//   return body;
// }

// async function fetchCities() {
//   const resp = await fetch("/api/va/cities");
//   const body: string[] = await resp.json();
//   return body;
// }

// export const App = () => {
//   const [cities, setCities] = useState(["Odense"]);
//   const [city, setCity] = useState(localStorage.getItem("city") || cities[0]);
//   const [data, setData] = useState<WeatherForecastResponse>({
//     tv2: [],
//     dmi: [],
//     yr: [],
//     owm: [],
//   });
//   const [isLoading, setIsLoading] = useState(false);

//   const setDefaultTheme = () => {
//     const head = document.getElementsByTagName("head")[0];
//     const link = head.getElementsByTagName("link")[0];
//     const darkCss =
//       "https://cdn.jsdelivr.net/gh/kognise/water.css@latest/dist/dark.min.css";
//     const lightCss =
//       "https://cdn.jsdelivr.net/gh/kognise/water.css@latest/dist/light.min.css";
//     const theme = localStorage.getItem("theme");
//     if (theme) {
//       if (theme === "dark") {
//         link.href = darkCss;
//       } else {
//         link.href = lightCss;
//       }
//     }
//   };

//   useEffect(() => {
//     async function fetchData() {
//       setIsLoading(true);

//       const forecasts = await fetchWeatherData(city);
//       setData(forecasts);

//       setIsLoading(false);
//     }
//     fetchData();
//   }, [city]);

//   useEffect(() => {
//     async function fetchData() {
//       const cities = await fetchCities();
//       setCities(cities);
//     }
//     fetchData();
//     setDefaultTheme();
//   }, []);

//   const setCityHelper = (city: string) => {
//     localStorage.setItem("city", city);
//     setCity(city);
//   };

//   return (
//     <main>
//       <section>
//         <h1>Vejr Aggregator</h1>
//         <div>
//           <select
//             disabled={isLoading}
//             value={city}
//             onChange={(e) => setCityHelper(e.currentTarget.value)}
//             name="city"
//             id="city"
//           >
//             {cities.map((city) => (
//               <option key={city} value={city}>
//                 {city}
//               </option>
//             ))}
//           </select>
//         </div>
//         {isLoading ? <div>Loading...</div> : <WeatherGrid {...data} />}
//       </section>
//       <Footer />
//     </main>
//   );
// };
