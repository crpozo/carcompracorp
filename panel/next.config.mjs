/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Export estático: el panel es 100% client-side (Auth y fetch en el navegador),
  // así que `next build` genera una carpeta `out/` que se sirve tal cual en
  // Amplify Hosting / cualquier hosting estático. `next dev` no se ve afectado.
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
