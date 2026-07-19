import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CarCompra · Panel de Leads',
  description: 'Panel de supervisión (solo lectura) de leads de CarCompra.',
};

// El Authenticator (Cognito) se aplica por página en app/page.tsx — así las
// páginas públicas como /privacidad no exigen login.
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
