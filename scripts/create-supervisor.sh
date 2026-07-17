#!/usr/bin/env bash
#
# create-supervisor.sh
# -----------------------------------------------------------------------------
# Crea el usuario supervisor en el User Pool de Cognito que usa el panel.
#
# Cognito genera una contraseña TEMPORAL y se la envía por correo al usuario;
# en el primer inicio de sesión el panel le pedirá cambiarla.
#
# Uso:
#   ./create-supervisor.sh <email> <user-pool-id>
#
# Ejemplo:
#   ./create-supervisor.sh supervisor@empresa.com us-east-1_ABC123XYZ
#
# ¿De dónde sale el user-pool-id?
#   Es un output del stack de SAM. Después de 'sam deploy' búscalo así:
#     * En la salida de la terminal, en la sección "Outputs" (clave UserPoolId).
#     * O con:  aws cloudformation describe-stacks \
#                 --stack-name <tu-stack> \
#                 --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" \
#                 --output text
# -----------------------------------------------------------------------------

set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"

if [[ $# -ne 2 ]]; then
  echo "Uso: $0 <email> <user-pool-id>" >&2
  echo "Ejemplo: $0 supervisor@empresa.com us-east-1_ABC123XYZ" >&2
  exit 1
fi

EMAIL="$1"
USER_POOL_ID="$2"

echo "==> Creando supervisor '${EMAIL}' en el User Pool '${USER_POOL_ID}' (${REGION})..."

# admin-create-user genera una contraseña temporal y (por defecto) envía la
# invitación con la contraseña al correo del usuario.
aws cognito-idp admin-create-user \
  --user-pool-id "${USER_POOL_ID}" \
  --username "${EMAIL}" \
  --user-attributes Name=email,Value="${EMAIL}" Name=email_verified,Value=true \
  --desired-delivery-mediums EMAIL \
  --region "${REGION}"

echo
echo "==> Usuario creado. Cognito envió la contraseña temporal a: ${EMAIL}"
echo "    En el primer login el panel le pedirá establecer una contraseña nueva."
