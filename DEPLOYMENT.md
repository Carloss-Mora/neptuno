# Publicar Neptuno

## Configuración obligatoria

1. Copia `.env.example` a `.env` y reemplaza los valores de ejemplo. Genera una clave de PocketBase de 32 caracteres con:

   ```powershell
   node -e "console.log(require('node:crypto').randomBytes(16).toString('hex'))"
   ```

   Conserva esa clave en el gestor de secretos del servidor y en copias de seguridad seguras. No la cambies después de inicializar PocketBase.
2. Define `PB_ENCRYPTION_KEY`, `PUBLIC_APP_URL` (la URL pública HTTPS del frontend), `VITE_POCKETBASE_URL` (la URL pública HTTPS de PocketBase) y `NODE_ENV=production`.
3. Configura la entrega de correo en PocketBase:
   - Configura SMTP en los ajustes de PocketBase, o
   - Define `BUILDER_MAILER_SENDER_ADDRESS`, `BUILDER_MAILER_API_URL` y `BUILDER_MAILER_API_KEY`.
   
   Verifica la recepción del código de seis dígitos antes de abrir los registros al público. Si usas Resend, `onboarding@resend.dev` solo entrega a destinatarios autorizados por Resend; para enviar a cualquier usuario, verifica tu propio dominio y utiliza un remitente de ese dominio.
4. Antes de iniciar el servicio de producción, respalda la base actual y define las variables anteriores en el entorno del proceso. La migración de usuarios verificados debe ejecutarse con `PUBLIC_APP_URL` configurada; en producción no se aceptan enlaces HTTP.
5. Configura Google OAuth: define `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` (el hook `google-from-env.pb.js` lo activa al arrancar) o actívalo a mano en la colección `users` de PocketBase. Crea primero las credenciales en Google Cloud, registra la URL de retorno que muestra PocketBase y restringe los orígenes/redirecciones a los dominios de Neptuno. El botón solo aparece cuando PocketBase anuncia Google como proveedor activo.

## Frontend y backend

- Compila el frontend con `npm run build --prefix apps/web` y publica `dist/apps/web` detrás de un servidor HTTPS. Configura una regla SPA para que las rutas de la aplicación respondan con `index.html`.
- Publica PocketBase detrás de HTTPS con un dominio propio y acceso administrativo restringido. No expongas su puerto de desarrollo sin proxy, TLS y controles de red apropiados.
- Asegura CORS, copias de seguridad automáticas y restauraciones probadas. Mantén las migraciones versionadas y aplícalas primero en una instancia de pruebas.
- El registro verifica el correo mediante un código OTP de seis dígitos, válido durante cinco minutos. Aplica la migración `1792450030_enable_email_otp.js` y configura un proveedor de correo transaccional antes de publicar; el acceso de contraseña sigue limitado a cuentas verificadas.
- `apps/pocketbase/pb_data` contiene datos locales y está excluido del repositorio. No subas bases de datos ni archivos de usuarios al control de versiones.
- El usuario demo está deshabilitado por defecto. No lo habilites en producción.

## Requisitos externos pendientes

- Credenciales de Google OAuth y un proveedor de correo con remitente/dominio autorizado.
- Dominio, DNS, HTTPS, hosting del frontend y del servicio PocketBase.
- Política de privacidad, términos, contacto de soporte y proceso de eliminación/exportación de datos, revisados para los países donde se operará.
- Integración y pruebas del controlador físico de bomba/válvula y sensores: esta aplicación por sí sola no acciona hardware real.
