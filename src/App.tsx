const sites = [
  "/dates/",
  "/timetracker/",
  "/va/",
  "/food-days/",
  "/hash-data/",
  "/map/",
];
function App() {
  const pathname = window.location.pathname;

  // Redirect from /dates to /dates/
  if (pathname?.length > 1 && pathname[pathname.length - 1] !== "/") {
    const newUrl = window.location.href + "/";
    const msg = `redirecting to ${newUrl}...`;
    console.log(msg);
    window.location.href = newUrl;
    return <p>{msg}</p>;
  }

  return (
    <>
      <h1>div</h1>
      <ul>
        {sites.map((site) => (
          <li>
            <a href={site}>{site}</a>
          </li>
        ))}
      </ul>
    </>
  );
}

export default App;
