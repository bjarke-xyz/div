interface Env {
  STARTPAGE: KVNamespace;
  UPDATE_KEY: string;
}

export interface LinkModel {
  type: "link" | "popup";
  category: string;
  href: string;
  label: string;
  args: {
    width: number;
  };
}

function getSTARTPAGE(env: Env): KVNamespace {
  return env.STARTPAGE;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  if (request.method === "GET") {
    return getLinks(request, env);
  } else if (request.method === "POST") {
    if (context.functionPath?.endsWith("keycheck")) {
      const keycheckResp = keycheck(request, env);
      if (keycheckResp) {
        return keycheckResp;
      }
      return new Response("OK", { status: 200 });
    } else {
      return postLinks(request, env);
    }
  }
  return new Response("Not found", {
    status: 404,
  });
};

function keycheck(request: Request, env: Env) {
  const updateKey: string = env.UPDATE_KEY;
  if (!updateKey) {
    return new Response(JSON.stringify({ error: "Missing key" }), {
      status: 500,
    });
  }
  if (request.headers.get("authorization") !== updateKey) {
    return new Response(JSON.stringify({ error: "Incorrect key" }), {
      status: 401,
    });
  }
  return null;
}

async function postLinks(request: Request, env: Env) {
  const keycheckResp = keycheck(request, env);
  if (keycheckResp) {
    return keycheckResp;
  }

  let links: LinkModel[] = [];
  try {
    links = (await request.json()) as LinkModel[];
    const validationError = validateLinks(links);
    if (validationError != null) {
      return new Response(JSON.stringify({ error: validationError }), {
        headers: {
          "Content-Type": "application/json",
        },
        status: 400,
      });
    }
  } catch (error) {
    console.log(error);
    return new Response(JSON.stringify({ error: "Could not read json" }), {
      headers: {
        "Content-Type": "application/json",
      },
      status: 400,
    });
  }

  const linksJson = JSON.stringify(links);
  await getSTARTPAGE(env).put("links", linksJson);
  return new Response(linksJson, {
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function validateLinks(links: LinkModel[]): string | null {
  if (!Array.isArray(links)) {
    return "Must be array";
  }
  if (links.length === 0) {
    return "Array cannot be empty";
  }

  let index = 0;
  for (const link of links) {
    if (!link.category) {
      return `links[${index}] missing category`;
    }
    if (!link.href) {
      return `links[${index}] missing href`;
    }
    if (!link.label) {
      return `links[${index}] missing label`;
    }
    if (!link.type) {
      return `links[${index}] missing type`;
    }
    index++;
  }
  return null;
}

async function getLinks(request: Request, env: Env) {
  const keycheckResp = keycheck(request, env);
  if (keycheckResp) {
    return keycheckResp;
  }
  const links = await getSTARTPAGE(env).get("links");
  if (links) {
    return new Response(links, {
      headers: {
        "Content-Type": "application/json",
      },
    });
  } else {
    return new Response("[]", {
      headers: {
        "Content-Type": "application/json",
      },
      status: 404,
    });
  }
}
