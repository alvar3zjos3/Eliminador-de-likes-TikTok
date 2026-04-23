# Eliminador de todos los videos con me gusta de TikTok

Elimina automáticamente todos los videos a los que has dado me gusta en TikTok con una sola acción.

---

## Funciones

- Abre automáticamente tu perfil de TikTok en una nueva pestaña.
- Usa las mismas APIs web autenticadas de TikTok que usa el sitio para listar y quitar los Me gusta.
- Incluye un panel de control dentro de TikTok con:
  - Estado en tiempo real y estadísticas básicas (páginas, eliminados, listados, fallos).
  - Pausa / Reanudar.
  - Informe descargable (JSON o CSV) con elementos eliminados y fallidos.
- Permite configurar el retraso entre eliminaciones (1–10 segundos, rango aleatorio o valores fijos).
- Filtro opcional por palabras clave para eliminar solo los Me gusta que coincidan con ciertos términos.

---

## Instalación

### Instalación manual (para desarrolladores)

1. Clona este repositorio o descarga el código fuente.
2. Ve a `chrome://extensions` en Google Chrome.
3. Activa el **Modo de desarrollador**.
4. Haz clic en **"Cargar descomprimida"** y selecciona la carpeta del proyecto.

---

## Cómo usarla

1. Asegúrate de haber iniciado sesión en tu cuenta de TikTok en [tiktok.com](https://tiktok.com).
2. Haz clic en el icono de la extensión en la barra de herramientas de Chrome.
3. Configura las opciones en el popup:
   - Filtrar por palabras clave o eliminar todos los Me gusta.
   - Modo de intervalo (rango aleatorio o conjunto fijo de segundos entre eliminaciones).
   - Pausa entre páginas y formato del informe (JSON o CSV).
4. Haz clic en **Empezar a eliminar Me gusta**.
5. Se abrirá automáticamente una pestaña de TikTok y aparecerá el panel dentro de la página, cerca de la esquina superior derecha.
6. Mantén la pestaña abierta hasta que termine el proceso. No la cierres durante la operación.

---

## Detalles de funcionamiento

- Si no has iniciado sesión y TikTok redirige `/profile` a `/foryou`, el panel:
  - Detecta que no has iniciado sesión.
  - Muestra un mensaje claro indicando que debes iniciar sesión y empezar de nuevo.
  - Marca el proceso como pausado y desactiva el botón de pausar/reanudar.
- Si la extensión no puede identificar tu cuenta, muestra un error similar y se detiene de forma segura.
- Al eliminar Me gusta:
  - Solo se eliminan los elementos que coincidan con el filtro por palabras clave, si está activado.
  - El panel lleva el conteo de páginas visitadas, elementos listados, eliminados y fallos.
- Fallos:
  - Cualquier fallo al eliminar se registra en el panel.
  - Los elementos fallidos se incluyen en el informe con una marca de estado.
  - Si fallan demasiadas eliminaciones seguidas, la extensión se detiene automáticamente.

---

## Formato del informe

El informe exportado desde el panel contiene todos los elementos procesados.

- JSON:
  - `removed`: elementos eliminados correctamente.
  - `failed`: elementos que no se pudieron eliminar.
- CSV:
  - `id`
  - `authorName`
  - `desc`
  - `url`
  - `status` (`removed` o `failed`)

---

## Permisos

La extensión usa los siguientes permisos de Chrome:

- `host_permissions` (`https://*.tiktok.com/*`): permite ejecutar la extensión solo en páginas de TikTok.
- `scripting`: inyecta y ejecuta el script de contenido y también ejecuta la solicitud para quitar el Me gusta en el contexto de la página.
- `tabs`: abre tu perfil de TikTok en una nueva pestaña y se comunica con esa pestaña.
- `cookies`: se usa solo en el popup para comprobar si has iniciado sesión en TikTok.
- `storage`: guarda tu configuración en el navegador.

No se usan analíticas, rastreo ni servidores externos. Todo ocurre en tu navegador y directamente contra TikTok.

---

## Notas importantes

- El proceso puede tardar según la cantidad de videos con Me gusta que tengas.
- Si TikTok bloquea temporalmente acciones por límite de uso, espera aproximadamente una hora y vuelve a ejecutar la extensión.
- Para confirmar que todo se eliminó, recarga tu perfil al terminar.

---

## Contribuciones

¡Las contribuciones son bienvenidas!
Si encuentras un error o tienes una idea de mejora, puedes abrir un issue o un pull request.

---

## Licencia

Este proyecto está bajo la licencia MIT.