// Un simulateur minimal de PostgREST, limité à ce que le site utilise :
// `POST /rest/v1/rpc/<fonction>` avec des paramètres nommés en JSON.
//
// Il parle au Postgres jetable de scripts/db-local.sh. Les fonctions qui
// rendent un ensemble (`returns table` / `setof`) répondent un tableau, les
// scalaires répondent la valeur nue, `void` répond null — comme PostgREST.
// Une erreur SQL répond 400 avec `{ code, message }`, `code` étant le
// SQLSTATE, ce que le client du site lit.
import http from "node:http";
import pg from "pg";

const port = Number(process.env.SHIM_PORT ?? 3100);
const pool = new pg.Pool({
  connectionString: process.env.SHIM_DATABASE_URL ?? "postgres://postgres@127.0.0.1:5544/site",
});
const kinds = new Map();

async function returnKind(name) {
  if (kinds.has(name)) return kinds.get(name);
  const { rows } = await pool.query(
    `select p.proretset as set, t.typname as type
       from pg_proc p join pg_type t on t.oid = p.prorettype
       join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = $1 limit 1`,
    [name],
  );
  const kind = rows[0] ? (rows[0].set || rows[0].type === "record" ? "set" : rows[0].type === "void" ? "void" : "scalar") : "missing";
  kinds.set(name, kind);
  return kind;
}

const server = http.createServer(async (req, res) => {
  const match = req.url?.match(/^\/rest\/v1\/rpc\/([a-z_]+)$/);
  if (!match || req.method !== "POST") {
    res.writeHead(404).end();
    return;
  }
  const name = match[1];
  let body = "";
  for await (const chunk of req) body += chunk;
  let params = {};
  try {
    params = body ? JSON.parse(body) : {};
  } catch {
    res.writeHead(400, { "content-type": "application/json" }).end(JSON.stringify({ code: "PGRST102", message: "corps illisible" }));
    return;
  }
  const kind = await returnKind(name);
  if (kind === "missing") {
    res.writeHead(404, { "content-type": "application/json" }).end(JSON.stringify({ code: "PGRST202", message: `fonction ${name} inconnue` }));
    return;
  }
  const keys = Object.keys(params);
  const args = keys.map((key, index) => `${key} := $${index + 1}`).join(", ");
  const values = keys.map((key) => {
    const value = params[key];
    return value !== null && typeof value === "object" ? JSON.stringify(value) : value;
  });
  const client = await pool.connect();
  try {
    await client.query("set role anon");
    const sql = kind === "set" ? `select * from public.${name}(${args})` : `select public.${name}(${args}) as value`;
    const { rows } = await client.query(sql, values);
    const payload = kind === "set" ? rows : kind === "void" ? null : (rows[0]?.value ?? null);
    res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(payload));
  } catch (error) {
    res
      .writeHead(400, { "content-type": "application/json" })
      .end(JSON.stringify({ code: error.code ?? "XX000", message: error.message, details: null, hint: null }));
  } finally {
    client.release();
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`rpc-shim prêt sur http://127.0.0.1:${port}/rest/v1/rpc/<fonction>`);
});
