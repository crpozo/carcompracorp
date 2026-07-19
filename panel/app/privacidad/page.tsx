import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Política de Privacidad · CarCompra',
  description:
    'Cómo CarCompra recopila y usa los datos de contacto recibidos por WhatsApp.',
};

// Página pública (sin login): es la URL de política de privacidad que exige
// Meta para publicar la app de WhatsApp.
export default function PrivacidadPage() {
  return (
    <main className="legal">
      <div className="legal-brand">
        <span className="legal-logo">🚗</span> CarCompra
      </div>
      <h1>Política de Privacidad</h1>
      <p className="legal-updated">Última actualización: 19 de julio de 2026</p>

      <h2>Quiénes somos</h2>
      <p>
        CarCompra es un servicio de venta de vehículos que atiende consultas de
        clientes a través de WhatsApp, en el número +593 98 523 8661.
      </p>

      <h2>Qué datos recopilamos</h2>
      <p>Cuando nos escribes por WhatsApp recibimos y almacenamos:</p>
      <ul>
        <li>Tu número de teléfono y el nombre de tu perfil de WhatsApp.</li>
        <li>El contenido del mensaje que nos envías.</li>
        <li>
          Si llegaste desde un anuncio, la referencia del anuncio que originó tu
          consulta.
        </li>
      </ul>

      <h2>Para qué los usamos</h2>
      <ul>
        <li>Atender tu consulta y darte información sobre los vehículos.</li>
        <li>Asignar tu solicitud a un asesor de ventas para que te contacte.</li>
        <li>Llevar un registro interno de las consultas recibidas.</li>
      </ul>

      <h2>Dónde se almacenan</h2>
      <p>
        Los datos se guardan en infraestructura de Amazon Web Services (AWS) con
        acceso restringido al personal autorizado de CarCompra. La mensajería se
        procesa a través de la plataforma WhatsApp Business de Meta.
      </p>

      <h2>Con quién los compartimos</h2>
      <p>
        No vendemos ni compartimos tus datos con terceros. Solo intervienen los
        proveedores tecnológicos necesarios para operar el servicio (Meta /
        WhatsApp y AWS), bajo sus propias políticas de privacidad.
      </p>

      <h2>Tus derechos</h2>
      <p>
        Puedes solicitar en cualquier momento el acceso, la corrección o la
        eliminación de tus datos escribiéndonos al mismo número de WhatsApp
        +593 98 523 8661.
      </p>
    </main>
  );
}
