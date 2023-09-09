import { ChangeEvent, FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { LinkModel } from "../lib/links";

export function Links() {
  const [linksJson, setLinksJson] = useState("");

  const [key, setKey] = useState("");

  const [textAreaHidden, setTextAreaHidden] = useState(true);

  const [messages, setMessages] = useState("");

  const onFormSubmit = async (event: FormEvent) => {
    event.preventDefault();
    showMessage("");
    try {
      JSON.parse(linksJson);
    } catch (error) {
      showMessage("Invalid JSON, check console");
      console.log(error);
      return;
    }

    try {
      const updateResp = await fetch("/api/startpage/links", {
        method: "POST",
        body: linksJson,
        headers: {
          "Content-Type": "application/json",
          authorization: key,
        },
      });
      const response = (await updateResp.json()) as LinkModel[] & {
        error: string;
      };
      if (response.error) {
        showMessage(response.error);
      } else {
        setLinksJson(JSON.stringify(response, null, 4));
        showMessage("Saved", 2000);
      }
    } catch (error) {
      showMessage("Could not save links, check console");
      console.log(error);
    }
  };

  const onTextAreaChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setLinksJson(event.target.value);
  };

  const onKeyChange = (event: ChangeEvent<HTMLInputElement>) => {
    setKey(event.target.value);
  };

  const onGetClick = async () => {
    showMessage("");
    try {
      const linksResp = await fetch("/api/startpage/links", {
        headers: {
          authorization: key,
        },
      });
      const response = (await linksResp.json()) as LinkModel[] & {
        error: string;
      };
      if (response.error) {
        showMessage(response.error);
      } else {
        setLinksJson(JSON.stringify(response, null, 4));
        setTextAreaHidden(false);
      }
    } catch (error) {
      showMessage("Could not get links, check console");
      console.log(error);
    }
  };

  const showMessage = (msg: string, removeAfter: number | null = null) => {
    setMessages(msg);
    if (removeAfter) {
      setTimeout(() => {
        setMessages("");
      }, removeAfter);
    }
  };

  return (
    <div>
      <Link to="/startpage">👈</Link>
      <form onSubmit={(e) => onFormSubmit(e)} style={{ padding: "1rem" }}>
        <div>
          <input
            value={key}
            onChange={(e) => onKeyChange(e)}
            placeholder="Key"
          ></input>
          <button type="button" onClick={onGetClick}>
            Get
          </button>
        </div>

        <div style={{ display: textAreaHidden ? "none" : "block" }}>
          <div>
            <textarea
              value={linksJson}
              onChange={(e) => onTextAreaChange(e)}
              cols={120}
              rows={50}
            ></textarea>
          </div>

          <button type="submit">Save</button>
        </div>
        <div>
          <p>{messages}</p>
        </div>
      </form>
    </div>
  );
}
