// auto-bid-narajangter-v1/main.ts

const indexHtml = await Deno.readTextFile(
  new URL("./index.html", import.meta.url),
);

Deno.serve((req) => {
  return new Response(indexHtml, {
    headers: {
      "content-type": "text/html; charset=utf-8",
    },
  });
});
