const sites = ["/dates/", "/timetracker/", "/startpage/"];
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
      <li>
        {sites.map((site) => (
          <ul>
            <a href={site}>{site}</a>
          </ul>
        ))}
      </li>
    </>
  );
}

export default App;
