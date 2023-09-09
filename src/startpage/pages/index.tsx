import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Box, BoxProps } from "../components/box";
import { BoxContainer } from "../components/box-container";
import { LinkModel } from "../lib/links";

export function Index() {
  const [links, setLinks] = useState([] as BoxProps[]);

  useEffect(() => {
    async function fetchData() {
      try {
        const resp = await fetch("/api/startpage/links");
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
      } catch (err) {
        console.log("Could not fetch links", err);
      }
    }
    fetchData();
  }, []);

  return (
    <div>
      <Link to="/startpage/links">✏️</Link>

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
