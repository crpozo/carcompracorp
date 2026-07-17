#!/usr/bin/env bash
#
# create-secret.sh
# -----------------------------------------------------------------------------
# Crea o actualiza el secreto de Secrets Manager "carcompra/whatsapp".
#
# El secreto guarda las credenciales de la WhatsApp Cloud API con estas claves:
#   WHATSAPP_TOKEN   -> token de acceso permanente de la app de Meta
#   VERIFY_TOKEN     -> token que tú inventas para verificar el webhook en Meta
#   PHONE_NUMBER_ID  -> ID del número de WhatsApp Business (Cloud API)
#
# IMPORTANTE:
#   * Este script debe ejecutarlo el DUEÑO de la cuenta AWS en su propia máquina,
#     con su AWS CLI ya configurado (aws configure).
#   * NUNCA pegues estas credenciales en un chat, ticket o repositorio. Este
#     script las lee de forma interactiva y NO las imprime ni las guarda en el
#     historial del shell.
# -----------------------------------------------------------------------------

set -euo pipefail

SECRET_ID="carcompra/whatsapp"
REGION="${AWS_REGION:-us-east-1}"

echo "==> Configurando el secreto '${SECRET_ID}' en la región '${REGION}'."
echo "    Introduce las credenciales de la WhatsApp Cloud API."
echo

# --- Lectura interactiva -----------------------------------------------------
# El token se lee con 'read -s' para que NO se muestre en pantalla ni quede
# registrado en el historial de la terminal.
read -r -s -p "WHATSAPP_TOKEN (no se mostrará): " WHATSAPP_TOKEN
echo
read -r -p "VERIFY_TOKEN (el que usarás en el webhook de Meta): " VERIFY_TOKEN
read -r -p "PHONE_NUMBER_ID: " PHONE_NUMBER_ID
echo

if [[ -z "${WHATSAPP_TOKEN}" || -z "${VERIFY_TOKEN}" || -z "${PHONE_NUMBER_ID}" ]]; then
  echo "ERROR: los tres valores son obligatorios. Abortando." >&2
  exit 1
fi

# --- Construir el JSON sin jq y sin echo del token ---------------------------
# Se usa un heredoc con python3 para escapar correctamente los valores como
# strings JSON. Esto evita romper el JSON si el token contiene caracteres
# especiales, y evita imprimir el token en ningún momento.
SECRET_JSON="$(
  WHATSAPP_TOKEN="${WHATSAPP_TOKEN}" \
  VERIFY_TOKEN="${VERIFY_TOKEN}" \
  PHONE_NUMBER_ID="${PHONE_NUMBER_ID}" \
  python3 - <<'PY'
import json, os
print(json.dumps({
    "WHATSAPP_TOKEN":  os.environ["WHATSAPP_TOKEN"],
    "VERIFY_TOKEN":    os.environ["VERIFY_TOKEN"],
    "PHONE_NUMBER_ID": os.environ["PHONE_NUMBER_ID"],
}))
PY
)"

# Liberar las variables sensibles del entorno del shell cuanto antes.
unset WHATSAPP_TOKEN VERIFY_TOKEN PHONE_NUMBER_ID

# --- Crear o actualizar el secreto -------------------------------------------
# Detecta si el secreto ya existe con describe-secret; si existe, actualiza el
# valor con put-secret-value, si no, lo crea con create-secret.
if aws secretsmanager describe-secret \
      --secret-id "${SECRET_ID}" \
      --region "${REGION}" >/dev/null 2>&1; then
  echo "==> El secreto ya existe. Actualizando su valor..."
  aws secretsmanager put-secret-value \
      --secret-id "${SECRET_ID}" \
      --secret-string "${SECRET_JSON}" \
      --region "${REGION}" >/dev/null
  echo "==> Secreto '${SECRET_ID}' actualizado correctamente."
else
  echo "==> El secreto no existe. Creándolo..."
  aws secretsmanager create-secret \
      --name "${SECRET_ID}" \
      --description "Credenciales WhatsApp Cloud API para carcompra" \
      --secret-string "${SECRET_JSON}" \
      --region "${REGION}" >/dev/null
  echo "==> Secreto '${SECRET_ID}' creado correctamente."
fi

# Liberar el JSON (aún contiene el token en memoria del shell).
unset SECRET_JSON

echo
echo "Listo. El valor del secreto nunca se imprimió en la terminal."
