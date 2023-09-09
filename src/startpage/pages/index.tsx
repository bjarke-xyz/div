import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Box, BoxProps } from "../components/box";
import { BoxContainer } from "../components/box-container";
import { LinkModel } from "../lib/links";
import { createCookie, eraseCookie, readCookie } from "../util/cookie";

const cookieName = "key";

export function Index() {
  const [error, setError] = useState("");
  const [key, setKey] = useState("");
  useEffect(() => {
    const cookieKey = readCookie(cookieName);
    if (cookieKey) {
      setKey(cookieKey);
    } else {
      const promptKey = prompt("key");
      if (promptKey) {
        createCookie(cookieName, promptKey, 365);
        setKey(promptKey);
      }
    }
  }, []);
  const [links, setLinks] = useState([] as BoxProps[]);

  useEffect(() => {
    async function fetchData() {
      try {
        const resp = await fetch("/api/startpage/links", {
          headers: {
            Authorization: key,
          },
        });
        const json = (await resp.json()) as LinkModel[];

        let links: BoxProps[] = [];

        json.forEach((link) => {
          let category = links.find((x) => x.title === link.category);
          if (!category) {
            category = {
              title: link.category,
              items: [],
            };
            links.push(category);
          }
          category.items.push({
            href: link.href,
            label: link.label,
            type: link.type,
            args: link.args,
          });
          category.items = category.items.sort((a, b) =>
            a.label.length > b.label.length ? 1 : -1
          );
        });
        links = links.sort((a, b) => (a.title > b.title ? 1 : -1));
        setLinks(links);
        setError("");
      } catch (err) {
        eraseCookie(cookieName);
        setError("could not fetch links, see console");
        console.log("Could not fetch links", err);
      }
    }
    if (key) {
      fetchData();
    }
  }, [key]);

  return (
    <div>
      <Link to="/startpage/links">✏️</Link>
      {error?.length > 0 && <div>{error}</div>}
      <BoxContainer>
        {(links ?? [])
          .filter((x) => !x.hidden)
          .map((box, i) => (
            <Box key={i} title={box.title} items={box.items}></Box>
          ))}
      </BoxContainer>
    </div>
  );
}
