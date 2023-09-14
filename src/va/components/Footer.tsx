export const Footer = () => {
  const sources = [
    { label: "TV2", url: "https://vejr.tv2.dk/" },
    { label: "DMI", url: "https://www.dmi.dk/" },
    { label: "YR", url: "https://developer.yr.no/" },
    { label: "OWM", url: "https://openweathermap.org/" },
  ];

  const changeTheme = () => {
    const head = document.getElementsByTagName("head")[0];
    const link = head.getElementsByTagName("link")[0];
    const darkCss =
      "https://cdn.jsdelivr.net/gh/kognise/water.css@latest/dist/dark.min.css";
    const lightCss =
      "https://cdn.jsdelivr.net/gh/kognise/water.css@latest/dist/light.min.css";

    if (link.href === darkCss) {
      link.href = lightCss;
      localStorage.setItem("theme", "light");
    } else {
      link.href = darkCss;
      localStorage.setItem("theme", "dark");
    }
  };

  return (
    <footer style={{ display: "flex", justifyContent: "space-between" }}>
      <div>
        Sources:{" "}
        {sources.map((x, i) => (
          <span key={i}>
            {" "}
            <a href={x.url}>{x.label}</a>
            {i !== sources.length - 1 ? <span>, </span> : null}
          </span>
        ))}
      </div>
      <div style={{ cursor: "pointer" }} onClick={changeTheme}>
        💡
      </div>
    </footer>
  );
};
