# Imágenes del README

Genera los SVG de `docs/readme/` con el estilo de la web (tema Midnight): Space Grotesk, Geist, Geist Mono, Shippori Mincho y Noto Sans JP.

GitHub muestra los SVG como imagen y **no carga fuentes web**, así que el texto se convierte a trazos con las fuentes reales. Cada letra se guarda una sola vez y se reutiliza (`<use>`), para que los archivos pesen poco.

```powershell
cd scripts\readme-assets
npm install
npm run build        # escribe en ..\..\docs\readme
```

- Textos, colores y diseños: `gen.mjs` (la paleta está en `lib.mjs`, copiada de `src/app/globals.css`).
- Si cambian las cifras del proyecto (pruebas, tablas…), actualízalas en la sección "Cifras" de `gen.mjs` y vuelve a generar.
- Esta carpeta tiene su propio `package.json`: no añade dependencias a la web.
