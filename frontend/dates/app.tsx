import { addSeconds, format } from "date-fns";
import { DateToOADate, OADateToDate } from "oadate";
import React, { useEffect, useState } from "react";

function formatTime(date: Date) {
  return format(date, "EEE dd MMM HH.mm.ss");
}

function App() {
  const [useLocalTimezone, setUseLocalTimezone] = useState(true);
  const useLocalTimezoneChange = () => {
    setUseLocalTimezone(!useLocalTimezone);
  };

  const [currentTime, setCurrentTime] = useState(new Date());
  const [currentTimeFormatted, setCurrentTimeFormatted] = useState(
    formatTime(currentTime)
  );

  useEffect(() => {
    setCurrentTimeFormatted(formatTime(currentTime));
    document.title = `Dates | ${formatTime(currentTime)}`;
  }, [currentTime]);

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch date from server because local computer time may be unreliable
        const response = await fetch("/date.txt");
        const nowStr = response.headers.get("date") ?? "";
        const now = new Date(Date.parse(nowStr));
        setCurrentTime(now);
      } catch (error) {
        console.log("Error fetching data", error);
      }
    }

    fetchData();
    const intervalId = setInterval(() => {
      fetchData();
    }, 5000);

    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const internvalId = setInterval(() => {
      setCurrentTime((c) => addSeconds(c, 1));
    }, 1000);
    return () => clearInterval(internvalId);
  }, []);

  return (
    <main>
      <header>
        <h1>Dates</h1>
        <span>{currentTimeFormatted}</span>
        <p>
          <a href="/swagger">API</a>
        </p>
      </header>
      <div>
        <label htmlFor="useLocalTimezone">Use local timezone</label>
        <input
          onChange={useLocalTimezoneChange}
          checked={useLocalTimezone}
          type="checkbox"
          id="useLocalTimezone"
        />
      </div>
      <details open>
        <OaDates useLocalTimezone={useLocalTimezone} />
      </details>

      <details open>
        <NaturalDates useLocalTimezone={useLocalTimezone} />
      </details>
    </main>
  );
}

function OaDates({ useLocalTimezone }: { useLocalTimezone: boolean }) {
  const [fromOaDateValue, setFromOaDateValues] = useState({
    input: "44582.83897428241",
    output: "2022-01-21T19:08:07.378Z",
  });

  const fromOaDateValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFromOaDateValues((state) => ({
      ...state,
      input: e.target.value,
    }));

    if (e.target.value) {
      const offset = useLocalTimezone ? new Date().getTimezoneOffset() : 0;
      const output = OADateToDate(Number(e.target.value), offset).toISOString();

      setFromOaDateValues((state) => ({
        ...state,
        output,
      }));
    }
  };

  const [toOaDateValue, setToOaDateValues] = useState({
    input: "2022-01-21T19:08:07.378Z",
    output: "44582.83897428241",
  });

  const toOaDateValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setToOaDateValues((state) => ({
      ...state,
      input: e.target.value,
    }));

    if (e.target.value) {
      const offset = useLocalTimezone ? new Date().getTimezoneOffset() : 0;
      const date = new Date(Date.parse(e.target.value));
      const output = DateToOADate(date, offset);
      console.log({ output, value: e.target.value });
      setToOaDateValues((state) => ({
        ...state,
        output,
      }));
    }
  };

  return (
    <>
      <summary>
        <h2>OA Dates</h2>
      </summary>
      <h3>From OA date</h3>
      <form>
        <div className="form-group">
          <input
            value={fromOaDateValue.input}
            onChange={fromOaDateValueChange}
          />
          <input value={fromOaDateValue.output} name="output" readOnly />
        </div>
      </form>
      <hr />
      <h3>To OA date</h3>
      <form>
        <div className="form-group">
          <input value={toOaDateValue.input} onChange={toOaDateValueChange} />
          <input value={toOaDateValue.output} name="output" readOnly />
        </div>
      </form>
      <hr />
      <p>
        An{" "}
        <a
          target="_blank"
          href="https://docs.microsoft.com/en-us/dotnet/api/system.datetime.tooadate?view=net-6.0#remarks"
          rel="noreferrer"
        >
          OLE Automation date
        </a>{" "}
        is implemented as a floating-point number whose integral component is
        the number of days before or after midnight, 30 December 1899, and whose
        fractional component represents the time on that day divided by 24. For
        example, midnight, 31 December 1899 is represented by 1.0; 6 A.M., 1
        January 1900 is represented by 2.25; midnight, 29 December 1899 is
        represented by -1.0; and 6 A.M., 29 December 1899 is represented by
        -1.25.
      </p>
      <p>
        The base OLE Automation Date is midnight, 30 December 1899. The minimum
        OLE Automation date is midnight, 1 January 0100. The maximum OLE
        Automation Date is the same as{" "}
        <a
          target="_blank"
          href="https://docs.microsoft.com/en-us/dotnet/api/system.datetime.maxvalue?view=net-6.0"
          rel="noreferrer"
        >
          DateTime.MaxValue
        </a>
        , the last moment of 31 December 9999.
      </p>
    </>
  );
}
function NaturalDates({ useLocalTimezone }: { useLocalTimezone: boolean }) {
  const parse = async (input: string) => {
    try {
      const resp = await fetch("/api/dates/naturaldate/parse", {
        method: "POST",
        body: JSON.stringify({
          naturalDate: input,
        }),
        headers: {
          "Content-Type": "application/json",
        },
      });
      const json = (await resp.json()) as { output: string };
      return json?.output ?? null;
    } catch (error) {
      console.log("Error during parse request", error);
    }
  };

  const [input, setInput] = useState("5 minutes ago");
  const [output, setOutput] = useState("2022-03-04T22:40:00.00000000");

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const onFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const parsedStr = await parse(input);
    if (parsedStr) {
      const date = new Date(Date.parse(parsedStr));
      if (useLocalTimezone) {
        date.setTime(date.getTime() + new Date().getTimezoneOffset());
      }
      setOutput(format(date, "yyyy-MM-dd'T'HH:mm:ss.SSSXX"));
    }
  };

  return (
    <>
      <summary>
        <h2>Natural date</h2>
      </summary>
      <form onSubmit={onFormSubmit}>
        <div className="form-group">
          <input value={input} onChange={onInputChange} />
          <input value={output} readOnly />
        </div>
        <button type="submit">Parse</button>
      </form>
    </>
  );
}

export default App;
