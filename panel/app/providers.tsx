'use client';

import { Amplify } from 'aws-amplify';
import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';

// Configure Amplify Auth (Cognito) once, at module load, from the public env
// vars. These are inlined into the client bundle at build time. Only accounts
// created by an administrator can sign in — self sign-up is disabled below via
// <Authenticator hideSignUp>.
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

export default function Providers({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Authenticator hideSignUp>
      {() => <>{children}</>}
    </Authenticator>
  );
}
