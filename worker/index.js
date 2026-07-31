const worker = {
  async fetch(request, env) {
    if (!env?.ASSETS) {
      return new Response("Komorebi House assets are unavailable.", {
        status: 503,
      });
    }

    const assetResponse = await env.ASSETS.fetch(request);
    const contentType = assetResponse.headers.get("content-type") ?? "";
    const body = contentType.includes("text/html")
      ? (await assetResponse.text()).replaceAll(
          "__KOMOREBI_ORIGIN__",
          new URL(request.url).origin,
        )
      : assetResponse.body;
    const response = new Response(body, assetResponse);
    response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("X-Frame-Options", "SAMEORIGIN");
    return response;
  },
};

export default worker;
