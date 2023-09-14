const CACHE_TIME_IN_SECONDS = 30 * 24 * 60 * 60; // 30 days
export const onRequest: PagesFunction = async (context) => {
  const cacheUrl = new URL(context.request.url);
  const cacheKey = new Request(cacheUrl.toString(), context.request);
  const cache = await caches.open("default");
  let response = await cache.match(cacheKey);
  if (!response) {
    const id = context.params.id;
    if (!id) {
      response = new Response("", { status: 400 });
    } else {
      const dmiUrl = `https://www.dmi.dk/assets/img/${id}.svg`;
      try {
        const fetchResp = await fetch(dmiUrl);
        const fetchBody = await fetchResp.text();
        response = new Response(fetchBody, {
          headers: {
            "Content-Type": "image/svg+xml",
          },
        });
      } catch (error) {
        console.error("dmi proxy error", error);
        response = new Response("DMI fetch error", { status: 500 });
      }
    }
    response.headers.append(
      "Cache-Control",
      `s-maxage=${CACHE_TIME_IN_SECONDS}`
    );
    context.waitUntil(cache.put(cacheKey, response.clone()));
  }
  return response;
};
