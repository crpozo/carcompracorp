'use client';

import { useEffect, useState } from 'react';
import { Amplify } from 'aws-amplify';
import { I18n } from 'aws-amplify/utils';
import { Authenticator, useAuthenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';

// Claves de almacenamiento local para "recordar mi correo". Solo se guarda el
// correo (nunca la contraseña — eso es del gestor de contraseñas del navegador).
export const REMEMBER_KEY = 'carcompra.rememberEmail';
export const EMAIL_KEY = 'carcompra.savedEmail';

// Spanish labels for the Authenticator UI.
I18n.putVocabularies({
  es: {
    'Sign in': 'Iniciar sesión',
    'Signing in': 'Ingresando…',
    'Sign In': 'Iniciar sesión',
    'Forgot your password?': '¿Olvidaste tu contraseña?',
    'Reset Password': 'Restablecer contraseña',
    'Send code': 'Enviar código',
    'Back to Sign In': 'Volver a iniciar sesión',
    'Change Password': 'Cambiar contraseña',
    'Changing': 'Cambiando…',
    'New password': 'Nueva contraseña',
    'Confirm Password': 'Confirmar contraseña',
    'Please confirm your Password': 'Confirma tu contraseña',
    'Submit': 'Continuar',
    'Code': 'Código',
    'Confirm': 'Confirmar',
  },
});
I18n.setLanguage('es');

// Configure Amplify Auth (Cognito) once, at module load, from the public env
// vars. Only accounts created by an administrator can sign in — self sign-up is
// disabled via <Authenticator hideSignUp>.
Amplify.configure(
  {
    Auth: {
      Cognito: {
        userPoolId: process.env.NEXT_PUBLIC_USER_POOL_ID ?? '',
        userPoolClientId: process.env.NEXT_PUBLIC_USER_POOL_CLIENT_ID ?? '',
      },
    },
  },
  { ssr: true }
);

function RememberEmailToggle() {
  const [remember, setRemember] = useState(true);
  useEffect(() => {
    setRemember(window.localStorage.getItem(REMEMBER_KEY) !== '0');
  }, []);
  const onChange = (checked: boolean) => {
    setRemember(checked);
    window.localStorage.setItem(REMEMBER_KEY, checked ? '1' : '0');
    if (!checked) window.localStorage.removeItem(EMAIL_KEY);
  };
  return (
    <label className="login-remember">
      <input
        type="checkbox"
        checked={remember}
        onChange={(e) => onChange(e.target.checked)}
      />
      Recordar mi correo en este dispositivo
    </label>
  );
}

// Login de tarjeta centrada (referencia "Welcome back"): logo arriba,
// título y subtítulo centrados; el fondo azul difuminado vive en el CSS.
const components = {
  SignIn: {
    Header() {
      return (
        <div className="login-head">
          <span className="login-logo">🚗</span>
          <h2>Bienvenido de nuevo</h2>
          <p>Ingresa tus credenciales para acceder a tu panel</p>
        </div>
      );
    },
    Footer() {
      // El footer custom reemplaza al de Amplify, así que re-exponemos aquí
      // el flujo de "olvidé mi contraseña" (código por correo vía Cognito).
      const { toForgotPassword } = useAuthenticator();
      return (
        <div>
          <RememberEmailToggle />
          <button
            type="button"
            className="login-forgot"
            onClick={toForgotPassword}
          >
            ¿Olvidaste tu contraseña?
          </button>
          <p className="login-foot">
            Panel de supervisión de CarCompra. Acceso solo para personal
            autorizado — las cuentas las crea un administrador.
          </p>
        </div>
      );
    },
  },
};

const baseFormFields = {
  signIn: {
    username: {
      label: 'Correo electrónico',
      placeholder: 'tucorreo@empresa.com',
      isRequired: true,
    },
    password: {
      label: 'Contraseña',
      placeholder: 'Tu contraseña',
    },
  },
};

export default function Providers({
  children,
}: {
  children: React.ReactNode;
}) {
  // Se resuelve en el cliente para poder precargar el correo guardado antes de
  // montar el formulario (defaultValue no se puede cambiar después del mount).
  const [formFields, setFormFields] = useState<Record<string, unknown> | null>(
    null
  );
  useEffect(() => {
    const saved = window.localStorage.getItem(EMAIL_KEY);
    if (saved) {
      setFormFields({
        ...baseFormFields,
        signIn: {
          ...baseFormFields.signIn,
          username: { ...baseFormFields.signIn.username, defaultValue: saved },
        },
      });
    } else {
      setFormFields(baseFormFields);
    }
  }, []);

  if (!formFields) return null;

  return (
    <Authenticator hideSignUp components={components} formFields={formFields}>
      {() => <>{children}</>}
    </Authenticator>
  );
}
