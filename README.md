# Tablero Agroseries (CREA)

Tablero web con tres vistas sobre los precios de Agroseries:

- **Foto**: matriz productos × insumos, desvío % de la relación en una fecha contra el promedio de un período.
- **Película**: evolución del poder de compra de un producto base frente a los insumos de un sector, mes a mes.
- **Variación**: variación % promedio en USD oficial por grupo de artículos entre dos meses.

## Estructura

```
index.html      la página (todo el cálculo corre en el navegador)
api/datos.js    función serverless que consulta dw.crea.org.ar con el usuario MEC
package.json    dependencia pg
vercel.json     tiempo máximo de la función (60 s)
```

## Cómo funciona la conexión

1. Al abrir, la página pide usuario y contraseña MEC.
2. Los manda por HTTPS a `/api/datos`, que se conecta a `dw.crea.org.ar:54322/warehouse`.
3. Primero baja el catálogo de productos (con categoría y subcategoría) y después los precios, en lotes de hasta 80.000 filas.
4. Las credenciales no se guardan en ningún lado. Para refrescar los datos, botón **Conectar a la base**.

## Publicar en Vercel

1. Subí esta carpeta a un repositorio de GitHub.
2. En vercel.com: **Add New → Project**, importá el repo y dejá todo por defecto (no hay paso de build).
3. Deploy.

O con la CLI, desde esta carpeta: `npx vercel --prod`.

## Si no conecta

La base tiene que aceptar conexiones desde los servidores de Vercel. Si da error de conexión (no de contraseña), hay que pedirle a CREA que habilite el acceso externo al puerto 54322.

## Editar listas

Las listas de insumos, productos, sectores y grupos están al principio del `<script>` de `index.html`, en el bloque `CONFIGURACIÓN`.
