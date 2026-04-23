# Política de privacidad

## Resumen

Eliminador de videos con me gusta de tiktok es una extensión de Chrome diseñada para ayudar a los usuarios a eliminar automáticamente todos los videos con Me gusta de su perfil de TikTok. Nos comprometemos a proteger tu privacidad y a garantizar que nunca se recopilen, almacenen ni compartan datos personales.

---

## Qué datos recopilamos

**No recopilamos ni transmitimos ningún dato personal.**
Toda la lógica de la extensión se ejecuta completamente en tu navegador y no se envía ninguna información a servidores externos.

En concreto:
- No recopilamos tus credenciales de TikTok.
- No accedemos a tu contenido de TikTok más allá de lo necesario para automatizar la eliminación de Me gusta.
- No rastreamos tu actividad ni tu comportamiento de navegación.

---

## Cómo funciona la extensión

La extensión realiza las siguientes acciones, completamente dentro de tu navegador:

- Abre [tiktok.com](https://www.tiktok.com) en una nueva pestaña del navegador.
- En tu perfil de TikTok, usa las mismas APIs web autenticadas que usa el sitio para:
  - Listar tus videos con Me gusta.
  - Enviar solicitudes para quitar cada Me gusta seleccionado.
- Permite filtrar opcionalmente por palabras clave.
- Muestra un panel dentro de la página con estado en vivo, pausa/reanudar y un informe descargable en JSON o CSV.

Todas las solicitudes se realizan **directamente desde tu navegador hacia TikTok** usando tu sesión actual.
No se envía ningún dato a ningún servidor controlado por esta extensión ni por su desarrollador.

---

## Servicios de terceros

Esta extensión no usa analítica de terceros, scripts de rastreo ni APIs externas.

---

## Explicación de permisos

La extensión usa los siguientes permisos de Chrome:

- `host_permissions` (`https://*.tiktok.com/*`): necesario para ejecutarse solo en páginas de TikTok.
- `scripting`: necesario para inyectar y ejecutar el script de contenido y para ejecutar la solicitud de quitar Me gusta en el contexto de la página.
- `tabs`: se usa para abrir tu perfil de TikTok en una nueva pestaña y comunicarse con esa pestaña.
- `cookies`: se usa solo en el popup para comprobar si has iniciado sesión en TikTok.
- `storage`: se usa para guardar tu configuración local en el navegador.

Estos permisos son los mínimos necesarios para que la extensión cumpla su función.
Nunca se usan para recopilar analíticas, rastrearte en otros sitios ni enviar datos a servicios externos.

---

## Contacto

Si tienes dudas o preocupaciones sobre la privacidad, puedes contactar con:

**Desarrollador:** Jose Alvarez

**GitHub:** https://github.com/alvar3zjos3
