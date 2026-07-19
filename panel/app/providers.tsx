'use client';

import { Amplify } from 'aws-amplify';
import { I18n } from 'aws-amplify/utils';
import { Authenticator, useAuthenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';

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

const formFields = {
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
  return (
    <Authenticator hideSignUp components={components} formFields={formFields}>
      {() => <>{children}</>}
    </Authenticator>
  );
}
