// Read-only, fixed-origin Kalshi order-book relay. Deploy as a Cloudflare Worker.
// No API keys. Only KXBTC15M ticker format is accepted. No trading endpoints.
const ALLOWED_ORIGIN = "https://anthonysmiller1974-arch.github.io";
export default {
  async fetch(request) {
    const origin=request.headers.get("Origin")||"";
    const cors={
      "Access-Control-Allow-Origin":ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods":"GET, OPTIONS",
      "Access-Control-Allow-Headers":"Content-Type",
      "Vary":"Origin",
      "Cache-Control":"no-store"
    };
    if(request.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
    if(request.method!=="GET")return new Response("Method not allowed",{status:405,headers:cors});
    const u=new URL(request.url);
    if(u.pathname!=="/orderbook")return new Response("Not found",{status:404,headers:cors});
    const ticker=(u.searchParams.get("ticker")||"").toUpperCase();
    if(!/^KXBTC15M-[A-Z0-9-]{4,80}$/.test(ticker))return new Response("Invalid ticker",{status:400,headers:cors});
    try {
      const endpoint="https://api.elections.kalshi.com/trade-api/v2/markets/"+encodeURIComponent(ticker)+"/orderbook?depth=10";
      const upstream=await fetch(endpoint,{headers:{"Accept":"application/json"},cf:{cacheTtl:0}});
      const body=await upstream.text();
      return new Response(body,{status:upstream.status,headers:{...cors,"Content-Type":"application/json; charset=utf-8"}});
    } catch(e) {
      return new Response(JSON.stringify({error:"Upstream unavailable"}),{status:502,headers:{...cors,"Content-Type":"application/json"}});
    }
  }
};
