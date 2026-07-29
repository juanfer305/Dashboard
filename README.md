# Libro — Dashboard de ingresos y gastos + Cuentas de cobro

Dashboard en HTML/CSS/JS que se conecta a:
- **Supabase** (base de datos propia, para tus movimientos y clientes)
- **Tu API de Vercel** (`Cuenta-de-cobro-pro`) para generar el PDF, mejorar la descripción con IA, y enviar por correo.

Como decidiste que este dashboard viva como **proyecto separado**, tu API en Vercel necesita permitir peticiones desde este nuevo dominio (CORS). Sin este paso, verás errores como `blocked by CORS policy` en la consola del navegador.

## 1. Configura Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com) si no tienes uno.
2. Ve a **SQL Editor** → pega el contenido de `supabase_schema.sql` → Run.
3. Ve a **Project Settings → API** y copia:
   - `Project URL`
   - `anon public` key
4. Pégalos en `js/config.js`.

## 2. Configura CORS en tu proyecto `Cuenta-de-cobro-pro`

En cada uno de tus 3 archivos de API (`render-pdf.ts`, `generate-description.ts`, `send-email.ts`), agrega estas líneas **al inicio del handler**, antes de cualquier otra lógica:

```ts
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // --- CORS: permite que tu dashboard externo llame a esta API ---
  res.setHeader('Access-Control-Allow-Origin', 'https://TU-DOMINIO-DEL-DASHBOARD.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  // --- fin CORS ---

  if (req.method !== 'POST') {
    ...
```

Reemplaza `https://TU-DOMINIO-DEL-DASHBOARD.vercel.app` por el dominio real donde despliegues este dashboard (o usa `'*'` temporalmente mientras pruebas en local — pero no lo dejes así en producción, ya que expondría tu API de generación de PDFs/envío de correo a cualquier sitio).

Después de editar, haz commit y push para que Vercel redeploye.

## 3. Configura `js/config.js`

```js
window.CONFIG = {
  SUPABASE_URL: "https://xxxx.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOi...",
  INVOICE_API_BASE: "https://cuenta-de-cobro-app.vercel.app", // tu app ya desplegada
};
```

## 4. Corre el dashboard localmente

No necesitas build ni backend propio — es HTML/CSS/JS puro.

```bash
# opción simple, sirve la carpeta con cualquier servidor estático
npx serve .
# o
python3 -m http.server 8080
```

Abre `http://localhost:8080`.

## 5. Despliega

Sube esta carpeta a un nuevo proyecto de Vercel (o Netlify/GitHub Pages) — es estático, no requiere configuración especial de build.

## Nota importante sobre el objeto que espera `render-pdf`

Tu endpoint `/api/render-pdf` navega a tu propia app (`host`) e inyecta el `state` en `localStorage['axyra_invoice_state_v4']`, esperando que la página de tu app **renderee la vista previa usando ese estado**. Eso significa que, al llamarlo desde un dominio distinto, la función seguirá navegando internamente a tu app de Vercel (`INVOICE_API_BASE`), no al dashboard — eso está bien, es el comportamiento esperado. Sólo revisa que la forma exacta del objeto `invoiceState` en `app.js` (función `buildInvoiceState`) coincida con los campos que tu componente de factura realmente lee del `localStorage`. Te dejé una estructura razonable basada en lo que compartiste, pero si tu formulario original usa otros nombres de campo (por ejemplo `client` en vez de `cliente`, o `items` como arreglo de líneas), ajusta esa función para que calce exacto.

## Qué falta / próximos pasos sugeridos

- **Guardar el PDF real**: hoy el PDF se descarga directo al navegador pero no se sube a ningún storage, así que el botón "Ver PDF" en la tabla de cuentas de cobro no funcionará entre sesiones. Si quieres el historial con PDFs recuperables, el siguiente paso es subir el `blob` a **Supabase Storage** y guardar esa URL en `pdf_url`.
- **Envío por correo**: el botón para usar `/api/send-email` no está conectado todavía (lo dejé fuera del flujo del modal para no sobrecargar el primer entregable) — puedo agregarlo como un botón "Enviar por correo" en la tabla de cuentas de cobro apenas confirmes que el PDF se genera bien.
- **Seguridad**: las tablas de Supabase están con RLS abierto (cualquiera con tu `anon key` puede leer/escribir). Bien para uso personal; si compartes el proyecto, conviene añadir Supabase Auth.
