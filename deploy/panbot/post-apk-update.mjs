
import path from "path";
import { fileURLToPath } from "url";
try { process.loadEnvFile(path.join(path.dirname(fileURLToPath(import.meta.url)), ".env")); } catch {}
const TOKEN = process.env.DISCORD_TOKEN;
if (!TOKEN) throw new Error("Falta DISCORD_TOKEN en .env");
const oruneiChannelId = "1573415038587240468"; // #orunei-updates (Canal exclusivo para updates)

const embedPayload = {
  embeds: [
    {
      title: "📱 ¡NUEVA ACTUALIZACIÓN DISPONIBLE: KAZE MOBILE v0.3.0! 🚀",
      description: "¡Ya está lista la nueva versión **0.3.0** de la aplicación oficial de **KAZE / Orunei** para Android!\n\nEsta versión trae sincronización total con el ecosistema de la web, mejoras críticas en el reproductor y funciones que la comunidad estaba pidiendo.",
      color: 0x9b59b6, // Morado neón estético
      fields: [
        {
          name: "👥 Sincronización Social y Amigos",
          value: "Tu lista de amigos, perfiles de usuario y actividad ahora están 100% conectados en tiempo real con la base de datos de la web.",
          inline: false
        },
        {
          name: "🎬 Salas de Cine (Watch Parties)",
          value: "Sincronización completa con las salas de cine en vivo de la web para ver anime con tus panas al mismo tiempo.",
          inline: false
        },
        {
          name: "🍿 Reproductor Nativo Mejorado",
          value: "El reproductor de streaming ahora funciona de forma fluida y totalmente integrada dentro de la aplicación (ya no se abre como app separada).",
          inline: false
        },
        {
          name: "🎰 Ruleta de la Suerte (Gacha Anime)",
          value: "La ruleta para descubrir animes aleatorios ahora muestra las carátulas e información visual completa.",
          inline: false
        },
        {
          name: "🔔 Notificaciones de Actualización Automáticas",
          value: "A partir de esta versión, la app te avisará automáticamente en pantalla cuando haya una nueva actualización en la web para que la descargues con un solo toque sin perder nada.",
          inline: false
        },
        {
          name: "🔓 Acceso Público Sin Sesión",
          value: "Ahora puedes consultar reseñas, comentarios de episodios y explorar todo el catálogo sin necesidad de iniciar sesión obligatoriamente.",
          inline: false
        },
        {
          name: "📥 ¿Cómo Descargar o Actualizar?",
          value: "Descarga la APK directamente desde el enlace oficial e instálala encima de tu versión actual (no pierdes tu configuración ni historial):\n\n👉 **[Descargar KAZE Mobile v0.3.0 (APK)](https://www.orunei.sbs/kaze.apk?v=3)**\n🌐 **[Visitar Web Oficial: orunei.sbs](https://www.orunei.sbs)**",
          inline: false
        }
      ],
      image: {
        url: "https://www.orunei.sbs/og.png"
      },
      footer: {
        text: "KAZE Mobile v0.3.0 (Build 3) • Orunei Ecosystem 🍿"
      },
      timestamp: new Date().toISOString()
    }
  ]
};

async function publish() {
  console.log("Intentando publicar anuncio de la APK en #orunei-updates...");
  for (const chId of [oruneiChannelId]) {
    try {
      const res = await fetch(`https://discord.com/api/v10/channels/${chId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bot ${TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(embedPayload)
      });
      const data = await res.json();
      if (res.ok) {
        console.log(`✅ Anuncio publicado exitosamente en canal ${chId}`);
      } else {
        console.error(`❌ Error en canal ${chId}:`, data);
      }
    } catch (e) {
      console.error(`Error conectando a canal ${chId}:`, e.message);
    }
  }
}

publish();
