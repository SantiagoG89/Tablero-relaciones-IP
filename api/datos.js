// ============================================================
// AGROSERIES - Función serverless (Vercel) que consulta el DW de CREA
// Recibe usuario y contraseña MEC en cada pedido (POST, HTTPS).
// No guarda credenciales ni datos.
// ============================================================

const { Client } = require("pg");

const HOST = "dw.crea.org.ar";
const PORT = 54322;
const DATABASE = "warehouse";

async function conectar(user, password) {
  const base = {
    host: HOST,
    port: PORT,
    database: DATABASE,
    user,
    password,
    connectionTimeoutMillis: 15000,
    statement_timeout: 55000,
  };
  // Primero intenta con SSL (como psycopg2 por defecto); si el servidor no lo soporta, sin SSL.
  try {
    const c = new Client({ ...base, ssl: { rejectUnauthorized: false } });
    await c.connect();
    return c;
  } catch (e) {
    if (/ssl/i.test(e.message)) {
      const c = new Client(base);
      await c.connect();
      return c;
    }
    throw e;
  }
}

function leerBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  try { return JSON.parse(req.body || "{}"); } catch { return {}; }
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  // GET: el tablero lo usa para saber que hay servidor disponible
  if (req.method === "GET") return res.status(200).json({ ok: true });
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  const { usuario, password, accion, ids } = leerBody(req);
  if (!usuario || !password) return res.status(400).json({ error: "Faltan usuario o contraseña." });

  let client;
  try {
    client = await conectar(String(usuario), String(password));
  } catch (e) {
    const auth = /password|authentication|pg_hba|role .* does not exist/i.test(e.message);
    return res.status(auth ? 401 : 502).json({
      error: auth
        ? "Usuario o contraseña incorrectos."
        : `No se pudo conectar con la base de CREA (${e.code || e.message}).`,
    });
  }

  try {
    if (accion === "productos") {
      const { rows } = await client.query(`
        SELECT pr.producto_id AS id,
               pr.producto_nombre AS nombre,
               pr.moneda,
               pr.categoria,
               pr.subcategoria,
               COUNT(p.producto_id)::int AS n
        FROM agroseries.productos pr
        LEFT JOIN agroseries.precios p ON p.producto_id = pr.producto_id
        GROUP BY pr.producto_id, pr.producto_nombre, pr.moneda, pr.categoria, pr.subcategoria
      `);
      return res.status(200).json({ productos: rows });
    }

    if (accion === "precios") {
      if (!Array.isArray(ids) || !ids.length || ids.length > 3000 ||
          !ids.every((x) => typeof x === "number" || typeof x === "string")) {
        return res.status(400).json({ error: "Lista de productos inválida." });
      }
      const { rows } = await client.query(
        `SELECT producto_id AS id,
                to_char(fecha, 'YYYY-MM-DD') AS f,
                precio::float8 AS p
         FROM agroseries.precios
         WHERE producto_id = ANY($1)`,
        [ids]
      );
      // Formato columnar para achicar la respuesta
      const out = { id: new Array(rows.length), f: new Array(rows.length), p: new Array(rows.length) };
      rows.forEach((r, i) => { out.id[i] = r.id; out.f[i] = r.f; out.p[i] = r.p; });
      return res.status(200).json(out);
    }

    return res.status(400).json({ error: "Acción desconocida." });
  } catch (e) {
    return res.status(500).json({ error: `Error en la consulta: ${e.message}` });
  } finally {
    await client.end().catch(() => {});
  }
};
