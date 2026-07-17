# carcompra — Leads de WhatsApp con round-robin y panel

Guía autoritativa de configuración y despliegue. Sigue los pasos en orden.

---

## 1. Qué es

**carcompra** captura los clientes que hacen clic en un anuncio "click-to-WhatsApp":
cuando la persona escribe al número de WhatsApp Business, un webhook (Lambda) crea
un **lead** en DynamoDB, lo asigna a un vendedor mediante **round-robin** (turnos
rotativos) y le notifica a ese vendedor por WhatsApp con la plantilla `nuevo_lead`.
Un supervisor entra al **panel** web (Next.js protegido con Cognito) para ver todos
los leads, su estado (`nuevo → contactado → interesado → cerrado / perdido`) y a qué
vendedor le tocó cada uno.

---

## 2. Arquitectura

```
   Anuncio "click-to-WhatsApp"
              │
              ▼
   WhatsApp Cloud API (Meta)
              │  POST webhook (mensajes entrantes)
              ▼
   API Gateway  ──►  Lambda (webhook)
                        │  1) crea lead        ┌───────────────────────┐
                        ├──────────────────────► carcompra-leads (DDB) │
                        │  2) round-robin       └───────────────────────┘
                        │     lee/incrementa   ┌───────────────────────┐
                        ├──────────────────────► carcompra-config      │
                        │                       └───────────────────────┘
                        │  3) elige vendedor   ┌───────────────────────┐
                        ├──────────────────────► carcompra-vendedores  │
                        │                       └───────────────────────┘
                        │  4) notifica         ┌───────────────────────┐
                        └──────────────────────► Secrets Manager        │
                             (token WhatsApp)   │  carcompra/whatsapp    │
                                                └───────────────────────┘
                        WhatsApp Cloud API  ◄── plantilla "nuevo_lead" al vendedor

   Supervisor ──► Panel Next.js ──► Cognito (login) ──► lee carcompra-leads
```

| Servicio AWS       | Recurso                                   | Rol |
|--------------------|-------------------------------------------|-----|
| API Gateway        | endpoint del webhook                       | recibe la verificación (GET) y los mensajes (POST) de Meta |
| Lambda             | función webhook (Node.js 20, ESM)          | crea el lead, aplica round-robin, notifica al vendedor |
| DynamoDB           | `carcompra-leads`                          | leads capturados (GSI `gsi-vendedor`, `gsi-estado`) |
| DynamoDB           | `carcompra-vendedores`                     | catálogo de vendedores y su orden |
| DynamoDB           | `carcompra-config`                         | contador de round-robin (`pk = roundrobin`) |
| Secrets Manager    | `carcompra/whatsapp`                       | `WHATSAPP_TOKEN`, `VERIFY_TOKEN`, `PHONE_NUMBER_ID` |
| Cognito            | User Pool                                  | autenticación del supervisor en el panel |

Variables de entorno de la Lambda:
`LEADS_TABLE=carcompra-leads`, `VENDEDORES_TABLE=carcompra-vendedores`,
`CONFIG_TABLE=carcompra-config`, `SECRET_ID=carcompra/whatsapp`,
`GRAPH_API_VERSION=v21.0`, `TEMPLATE_NAME=nuevo_lead`, `TEMPLATE_LANG=es`.

---

## 3. Prerrequisitos

1. **AWS CLI configurado con tu propia llave** (`aws configure`).
   > NUNCA pegues llaves de acceso, tokens ni contraseñas en chats, tickets o en el
   > repositorio. Todo se configura desde tu máquina.
2. **AWS SAM CLI**: `brew install aws-sam-cli`
3. **Node.js 20** (para el panel y el script de seed).
4. Región por defecto: **us-east-1** (los scripts respetan `AWS_REGION` si lo exportas).

---

## 4. Datos que faltan del cliente

Antes de lanzar, pídele al cliente:

- **Vendedores**: nombre, teléfono de WhatsApp (formato internacional, ej. `5939XXXXXXXX`)
  y el orden en que quiere que roten los turnos.
- **Correo del supervisor** que entrará al panel.
- **Turnos / reglas de asignación**: confirmar que el round-robin simple (uno tras otro)
  es lo que quiere, o si hay excepciones (vendedores inactivos, horarios, etc.).

---

## 5. Meta pendiente (WhatsApp Cloud API)

Para que las notificaciones funcionen hace falta, del lado de Meta / Facebook Business:

- **Token permanente** (`WHATSAPP_TOKEN`) de un usuario de sistema — no el token temporal
  de prueba de 24 h.
- **`PHONE_NUMBER_ID`** del número de WhatsApp Business.
- **Plantilla `nuevo_lead` aprobada**, categoría **Utility**, idioma **es**, con este
  texto de ejemplo (3 parámetros en el cuerpo, EN ESTE ORDEN — nombre, teléfono, origen):

  ```
  Nuevo lead: {{1}}
  Teléfono: {{2}}
  Origen: {{3}}
  Ingresa al panel para contactarlo.
  ```

  Los parámetros los envía la Lambda como `[lead.nombre, lead.telefono, lead.anuncioOrigen || 'Pauta']`.

---

## 6. Deploy paso a paso

```bash
# 1) Infraestructura (crea tablas, Lambda, API Gateway, Cognito)
cd infra
sam build
sam deploy --guided     # la primera vez; luego basta 'sam deploy'
# Anota los Outputs: WebhookUrl, UserPoolId, y los que use el panel.

# 2) Crear el secreto de WhatsApp (interactivo, no imprime el token)
cd ..
./scripts/create-secret.sh

# 3) Cargar vendedores
cp vendedores.example.json vendedores.json
#   edita vendedores.json con los datos reales del cliente
node scripts/seed-vendedores.mjs

# 4) Crear el usuario supervisor del panel
./scripts/create-supervisor.sh supervisor@empresa.com <UserPoolId>
```

> El `<UserPoolId>` sale de los Outputs de `sam deploy` (clave `UserPoolId`).

---

## 7. Conectar el webhook en Meta

En la configuración de WhatsApp de tu app en **Meta for Developers → WhatsApp → Configuration**:

- **Callback URL**: el output **`WebhookUrl`** del stack de SAM.
- **Verify token**: el mismo **`VERIFY_TOKEN`** que guardaste en el secreto
  `carcompra/whatsapp` (paso 6.2).
- Pulsa **Verify and save** (Meta hará un GET de verificación contra la Lambda).
- **Suscríbete al campo `messages`** (Webhook fields → `messages`) para recibir los
  mensajes entrantes.

---

## 8. Panel

```bash
cd panel
cp .env.local.example .env.local
#   completa .env.local con los Outputs del stack (UserPoolId, ClientId, región, API, etc.)
npm i
npm run dev
```

Abre el panel, inicia sesión con el correo del supervisor (contraseña temporal que
Cognito le envió por correo) y establece la contraseña definitiva.

---

## 9. Checklist de lanzamiento

- [ ] `sam build && sam deploy` completado; Outputs anotados.
- [ ] Secreto `carcompra/whatsapp` creado con token permanente, `VERIFY_TOKEN` y `PHONE_NUMBER_ID`.
- [ ] Vendedores cargados en `carcompra-vendedores` (`node scripts/seed-vendedores.mjs`).
- [ ] Item round-robin inicializado en `carcompra-config` (`pk = roundrobin`, `counter = 0`).
- [ ] Supervisor creado en Cognito y con acceso al panel.
- [ ] Plantilla `nuevo_lead` aprobada por Meta (categoría Utility, idioma es).
- [ ] Webhook verificado en Meta y suscrito al campo `messages`.
- [ ] Prueba real: escribir al número desde el anuncio → aparece el lead en el panel
      con estado `nuevo` y el vendedor asignado recibe la notificación de WhatsApp.

---

## 10. Seguridad

- El token de WhatsApp vive **solo** en Secrets Manager (`carcompra/whatsapp`). No se
  guarda en el código, ni en variables de entorno en texto plano, ni en el repo.
- El script `create-secret.sh` lee el token con `read -s`: no se muestra en pantalla ni
  queda en el historial del shell.
- El `.gitignore` excluye `.env*`, `vendedores.json`, `aws-exports.js`, `samconfig.toml`,
  `*.zip`, etc. Solo se versionan los archivos `*.example`.
- **Si una credencial se expone** (en logs, en un chat, en un commit): revócala y
  regenérala de inmediato en Meta / IAM, y actualiza el secreto con `create-secret.sh`.
  Rotar es más rápido que lamentar.
