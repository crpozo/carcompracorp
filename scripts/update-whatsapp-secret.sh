#!/usr/bin/env bash
#
# update-whatsapp-secret.sh
# -----------------------------------------------------------------------------
# Actualiza SOLO WHATSAPP_TOKEN y PHONE_NUMBER_ID en el secreto
# carcompra/whatsapp, CONSERVANDO el VERIFY_TOKEN existente (que ya está
# conectado al webhook en Meta — no hay que regenerarlo).
#
# Úsalo cuando tengas el token permanente del usuario del sistema de Meta.
# Lo corre el dueño de la cuenta en SU terminal. Nunca pegar tokens en chats,
# commits ni logs.
#
# Uso:
#   ./update-whatsapp-secret.sh
# -----------------------------------------------------------------------------

set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"
SECRET_ID="carcompra/whatsapp"

echo "== Actualizar credenciales de WhatsApp en ${SECRET_ID} (${REGION}) =="
# read -s: el token no se muestra en pantalla ni queda en el historial.
read -r -s -p "Pega el TOKEN PERMANENTE de WhatsApp (no se mostrará): " WHATSAPP_TOKEN
echo
read -r -p "PHONE_NUMBER_ID (App > WhatsApp > API Setup): " PHONE_NUMBER_ID

if [[ -z "${WHATSAPP_TOKEN}" || -z "${PHONE_NUMBER_ID}" ]]; then
  echo "ERROR: ambos valores son obligatorios." >&2
  exit 1
fi

# Lee el secreto actual para conservar el VERIFY_TOKEN.
CURRENT=$(aws secretsmanager get-secret-value \
  --secret-id "${SECRET_ID}" --region "${REGION}" \
  --query SecretString --output text)

# Construye el JSON nuevo vía variables de entorno (no argv: los argumentos de
# proceso son visibles en `ps`; el entorno del propio proceso no).
NEW_SECRET=$(CURRENT="${CURRENT}" WHATSAPP_TOKEN="${WHATSAPP_TOKEN}" \
  PHONE_NUMBER_ID="${PHONE_NUMBER_ID}" python3 - <<'PY'
import json, os
cur = json.loads(os.environ["CURRENT"])
print(json.dumps({
    "WHATSAPP_TOKEN": os.environ["WHATSAPP_TOKEN"],
    "VERIFY_TOKEN": cur["VERIFY_TOKEN"],
    "PHONE_NUMBER_ID": os.environ["PHONE_NUMBER_ID"],
}))
PY
)

aws secretsmanager put-secret-value \
  --secret-id "${SECRET_ID}" --region "${REGION}" \
  --secret-string "${NEW_SECRET}" \
  --query VersionId --output text >/dev/null

echo "✅ Secreto actualizado (VERIFY_TOKEN conservado)."
echo
echo "NOTA: la Lambda cachea el secreto entre invocaciones calientes."
echo "Para forzar que tome el token nuevo de inmediato:"
echo "  aws lambda update-function-configuration \\"
echo "    --function-name \$(aws lambda list-functions --region ${REGION} \\"
echo "      --query \"Functions[?starts_with(FunctionName,'carcompra-WebhookFunction')].FunctionName\" --output text) \\"
echo "    --description \"refresh secreto \$(date +%s)\" --region ${REGION} >/dev/null"
echo "(o simplemente espera unos minutos a que roten los contenedores)."
