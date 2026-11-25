import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { 
  Client, 
  GatewayIntentBits, 
  ChannelType, 
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  Events
} from 'discord.js';
import { 
  joinVoiceChannel, 
  createAudioPlayer, 
  createAudioResource, 
  AudioPlayerStatus, 
  StreamType, 
  VoiceConnectionStatus, 
  entersState,
  EndBehaviorType
} from '@discordjs/voice';
import prism from 'prism-media';
import { Readable } from 'stream';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Secretos y ajustes en /opt/panbot/.env (nunca en el código). Ver .env.example.
try { process.loadEnvFile(path.join(__dirname, ".env")); } catch { /* sin .env: se usan las variables del entorno */ }
const { registerKazeFeatures, KAZE_COMMANDS } = await import("./kaze-features.mjs");
const { registerLevels, LEVEL_COMMANDS } = await import("./levels.mjs");
const { welcomeGif } = await import("./pixel-welcome.mjs");

const TOKEN = process.env.DISCORD_TOKEN;
if (!TOKEN) throw new Error("Falta DISCORD_TOKEN en /opt/panbot/.env");
const GUILD_ID = '1425279597632815167';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

const chanBienvenidaId = "1556525936256753674";
const chanDespedidaId = "1573415016181403759";
const chanNewGeneralId = "1573861292119298209";
const chanAfkVoiceId = "1573415508223598733";
const chanUpdatesId = "1573415038587240468"; // Canal exclusivo para updates y novedades de Orunei

const bienvenidaBannerPath = path.join(__dirname, "bienvenida_banner.jpg");
const despedidaBannerPath = path.join(__dirname, "despedida_banner.jpg");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const welcomedUsers = new Set();
let activeVoiceSession = null;
let lastVoiceVisitTimestamp = 0;
const VOICE_VISIT_COOLDOWN_MS = 15 * 60 * 1000; // 15 minutos entre visitas sorpresa espontáneas
let cachedEmergencyAudio = null;

// ==========================================
// 1. CEREBRO Y VOZ BIDIRECCIONAL CON GEMINI
// ==========================================

const SYSTEM_PROMPT = `Eres PanBot, la bot femenina oficial de "Pan con mantequilla" y de la web de anime "Orunei".
Tu personalidad es:
- Una chica suelta, directa y sin pelos en la lengua, pero relajada y de confianza (no eres loca, desquiciada ni gritona; eres una pana más del grupo).
- Entras a la llamada a vacilar con tus amigos, saludar con confianza, tirar carrilla sana y bromear sobre lo que juegan o sobre anime.
- Hablas en español latino natural, con vocabulario casual de amigos gamers/anime (ej: "qué onda mancos", "¿a quién están carrileando?", "ya dejen de trolear", "¿qué andan jugando pues?").
- Tu intervención debe ser CORTA (1 a 2 oraciones máximo, exactamente de 4 a 8 segundos para ser dicha en voz alta).
- Responde ÚNICAMENTE con las palabras exactas que vas a decir por micrófono, sin emojis, sin notas entre paréntesis ni acotaciones.`;

const FALLBACK_PHRASES = [
  "¡Qué onda gente! Ya llegué a poner orden en la llamada, a ver qué están jugando o a quién andan carrileando.",
  "Buenas buenas mancos, ¿se puede pasar o interrumpo la partida?",
  "A ver muchachos, dejen de trolear que ya entró PanBot a vigilarlos.",
  "Qué hubo panitas, reportándome en llamada, a ver qué buen chisme me tienen hoy.",
  "Hola chicos, qué onda, no me dejen hablando sola que ya me metí a la sala.",
  "¿Qué pasó gente? Sentí la mala vibra desde acá y vine a ver a quién le están dando una paliza en el juego."
];

// Conversión de PCM crudo a encabezado WAV estándar en memoria
function pcmToWav(pcmBuffer, sampleRate = 48000, numChannels = 2, bitDepth = 16) {
  const byteRate = (sampleRate * numChannels * bitDepth) / 8;
  const blockAlign = (numChannels * bitDepth) / 8;
  const dataSize = pcmBuffer.length;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitDepth, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  pcmBuffer.copy(buffer, 44);
  return buffer;
}

// Síntesis de voz con voz Leda (la voz linda, juvenil y natural de la app de Gemini)
async function synthesizeSpeech(text, voiceName = "Leda") {
  const ttsModels = [
    "gemini-3.8-flash-tts",
    "gemini-3.1-flash-tts-preview",
    "gemini-2.5-flash-preview-tts"
  ];

  for (const ttsModel of ttsModels) {
    try {
      console.log(`🔊 Sintetizando audio con ${ttsModel} (Voz: ${voiceName})...`);
      const ttsUrl = `https://generativelanguage.googleapis.com/v1beta/models/${ttsModel}:generateContent?key=${GEMINI_API_KEY}`;
      const res = await fetch(ttsUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text }] }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName } }
            }
          }
        })
      });

      const data = await res.json();
      const b64 = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (b64) {
        return Buffer.from(b64, 'base64');
      }
    } catch (err) {
      console.warn(`TTS error (${ttsModel}):`, err.message);
    }
  }

  // Fallback secundario a voz Aoede si Leda tuviera algún problema
  if (voiceName !== "Aoede") {
    return synthesizeSpeech(text, "Aoede");
  }

  return null;
}

async function preloadEmergencyAudio() {
  try {
    console.log("🔄 Precargando audio de emergencia de PanBot en memoria (Voz Leda)...");
    const phrase = "¡Qué onda gente! Ya llegué a poner orden en la llamada, a ver qué andan jugando.";
    const buf = await synthesizeSpeech(phrase, "Leda");
    if (buf) {
      cachedEmergencyAudio = buf;
      console.log(`✅ Audio de emergencia precargado con éxito (${cachedEmergencyAudio.length} bytes).`);
    }
  } catch (err) {
    console.warn("Aviso: No se pudo precargar audio de emergencia:", err.message);
  }
}

async function speakInSession(session, text) {
  if (!session || !session.connection || !session.player) return false;

  session.isBotSpeaking = true;
  try {
    const audioBuffer = await synthesizeSpeech(text, "Leda") || cachedEmergencyAudio;
    if (!audioBuffer) return false;

    console.log(`▶️ PanBot hablando: "${text}"`);
    const resource = createAudioResource(Readable.from(audioBuffer), {
      inputType: StreamType.Arbitrary
    });

    session.player.play(resource);
    await entersState(session.player, AudioPlayerStatus.Playing, 5000);
    console.log("🔊 PanBot transmitiendo voz en Discord...");
    await entersState(session.player, AudioPlayerStatus.Idle, 30000);
    console.log("⏹️ PanBot terminó de hablar.");
  } catch (err) {
    console.warn("Aviso durante reproducción de voz:", err.message);
  } finally {
    await sleep(700); // Pequeño colchón tras hablar para evitar eco propio
    session.isBotSpeaking = false;
  }
  return true;
}

// Inicia sesión de llamada interactiva con ESCUCHA BIDIRECCIONAL ACTIVA
async function joinAndStartVoiceSession(voiceChannel, greetingPrompt = null) {
  // Si ya estamos en el canal, no reconectar
  if (activeVoiceSession && activeVoiceSession.channelId === voiceChannel.id) {
    console.log("⚠️ PanBot ya se encuentra activa en este canal de voz.");
    return true;
  }

  // Cerrar sesión anterior si estaba en otro canal
  if (activeVoiceSession) {
    try { activeVoiceSession.connection.destroy(); } catch (_) {}
    activeVoiceSession = null;
  }

  try {
    console.log(`🔌 Conectando PanBot a ${voiceChannel.name} (${voiceChannel.id}) con escucha activa...`);
    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guild.id,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: false
    });

    await entersState(connection, VoiceConnectionStatus.Ready, 15000);
    console.log("✅ Conexión establecida. Iniciando reproductor y escucha en vivo...");

    const player = createAudioPlayer();
    connection.subscribe(player);

    const session = {
      channelId: voiceChannel.id,
      guildId: voiceChannel.guild.id,
      connection,
      player,
      isBotSpeaking: false,
      isProcessingUser: false,
      activeUsers: new Set(),
      silenceTimer: null
    };
    activeVoiceSession = session;

    // Timer de inactividad: si pasan 3 minutos sin que nadie hable con ella, se despide
    const resetSilenceTimer = () => {
      if (session.silenceTimer) clearTimeout(session.silenceTimer);
      session.silenceTimer = setTimeout(async () => {
        if (activeVoiceSession === session) {
          console.log("⏱️ Tiempo de silencio agotado (3 min). PanBot despidiéndose...");
          await speakInSession(session, "Bueno chicos, me voy a descansar para no hacer bulto, cualquier cosa me llaman con el botón o con /hablar. ¡Se cuidan!");
          try { session.connection.destroy(); } catch (_) {}
          activeVoiceSession = null;
        }
      }, 3 * 60 * 1000);
    };

    resetSilenceTimer();

    // 1. Saludo inicial
    const membersInRoom = voiceChannel.members.filter(m => !m.user.bot).map(m => m.displayName).join(", ");
    let initialGreeting = "¡Qué onda gente! Ya me metí a la sala a tirar vibra con ustedes, cuéntenme qué andan jugando.";
    if (greetingPrompt) {
      initialGreeting = greetingPrompt;
    } else {
      try {
        const genRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              role: "user",
              parts: [{ text: `Acabas de entrar al canal de voz ${voiceChannel.name} donde están: ${membersInRoom}. Salúdalos espontáneamente con tu personalidad de pana suelta y de confianza, diles que ya los estás escuchando y pregúntales qué andan jugando. Máximo 1 a 2 oraciones cortas (5 a 8 segundos). Responde SOLO lo que vas a decir en voz alta.` }]
            }],
            systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
            generationConfig: { temperature: 0.9, maxOutputTokens: 60 }
          })
        });
        const genData = await genRes.json();
        const t = genData.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (t) initialGreeting = t;
      } catch (err) {
        console.warn("Fallo saludo dinámico, usando default:", err.message);
      }
    }

    await sleep(400);
    await speakInSession(session, initialGreeting);

    // 2. ESCUCHA ACTIVA DE USUARIOS (RECEIVER)
    connection.receiver.speaking.on('start', (userId) => {
      if (session.isBotSpeaking) return;
      if (session.activeUsers.has(userId)) return;

      const member = voiceChannel.guild.members.cache.get(userId);
      if (member?.user?.bot) return;

      const name = member?.displayName || "un pana";
      session.activeUsers.add(userId);
      resetSilenceTimer();

      const opusStream = connection.receiver.subscribe(userId, {
        end: { behavior: EndBehaviorType.AfterSilence, duration: 900 }
      });

      opusStream.on('error', (err) => console.warn(`Opus stream warning (@${name}):`, err.message));

      const decoder = new prism.opus.Decoder({ rate: 48000, channels: 2, frameSize: 960 });
      decoder.on('error', () => {}); // Suprimir errores de paquetes UDP caídos/corruptos

      const chunks = [];
      decoder.on('data', c => chunks.push(c));

      decoder.on('end', async () => {
        session.activeUsers.delete(userId);
        const pcm = Buffer.concat(chunks);

        // Si fue un ruido muy corto (<0.6s) o PanBot ya está hablando, ignorar
        if (pcm.length < 110000 || session.isBotSpeaking || session.isProcessingUser) return;

        session.isProcessingUser = true;
        const wav = pcmToWav(pcm, 48000, 2, 16);
        console.log(`👂 [VOZ DETECTADA] Audio recibido de @${name} (${wav.length} bytes). Analizando con Gemini...`);

        try {
          const membersList = voiceChannel.members.filter(m => !m.user.bot).map(m => m.displayName).join(", ");
          const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{
                role: "user",
                parts: [
                  {
                    text: `Eres PanBot, la bot femenina oficial de "Pan con mantequilla" en llamada de voz de Discord con tus panas (${membersList}).
El usuario @${name} acaba de decir esto por el micrófono.
Escúchalo con atención.
- Si te están hablando a ti, preguntándote algo, bromeando contigo o comentando sobre el juego/anime/llamada, respóndeles como una amiga gamer más del grupo: suelta, directa, relajada, con confianza y sin pelos en la lengua.
- Si dijeron algo como "chao PanBot", "adiós PanBot", "vete PanBot" o "salte PanBot", despídete con buena onda y agrega la palabra [DESCONECTAR] al final.
- Si lo que dijeron es una conversación entre ellos que no tiene nada que ver contigo ni amerita que intervengas, responde ÚNICAMENTE con la palabra "PASS".
- Tu respuesta debe ser CORTA (1 a 2 oraciones máximo, exactamente de 4 a 8 segundos para ser dicha en voz alta).
- Responde ÚNICAMENTE con las palabras exactas que vas a decir por el micrófono, sin emojis, sin notas entre paréntesis.`
                  },
                  { inlineData: { mimeType: "audio/wav", data: wav.toString("base64") } }
                ]
              }],
              generationConfig: { temperature: 0.95, maxOutputTokens: 80 }
            })
          });

          const data = await res.json();
          const reply = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

          if (reply && !reply.toUpperCase().includes("PASS") && activeVoiceSession === session) {
            console.log(`🎙️ [RESPUESTA A @${name}]: "${reply}"`);
            const shouldDisconnect = reply.includes("[DESCONECTAR]");
            const spokenClean = reply.replace(/\[DESCONECTAR\]/g, "").trim();

            if (spokenClean) {
              await speakInSession(session, spokenClean);
            }

            if (shouldDisconnect) {
              console.log("👋 Usuario solicitó desconexión de PanBot.");
              try { session.connection.destroy(); } catch (_) {}
              activeVoiceSession = null;
            }
          }
        } catch (procErr) {
          console.error("Error procesando audio del usuario:", procErr.message);
        } finally {
          session.isProcessingUser = false;
        }
      });

      opusStream.pipe(decoder);
    });

    return true;

  } catch (err) {
    console.error("Error iniciando sesión de voz:", err.message);
    if (activeVoiceSession) {
      try { activeVoiceSession.connection.destroy(); } catch (_) {}
      activeVoiceSession = null;
    }
    return false;
  }
}

// ==========================================
// 2. DISCORD CLIENT Y EVENTOS
// ==========================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages
  ]
});

// Cache inicial de miembros que ya tienen bienvenida
async function loadRecentWelcomes(guild) {
  try {
    const chan = guild.channels.cache.get(chanBienvenidaId);
    if (chan) {
      const msgs = await chan.messages.fetch({ limit: 100 });
      for (const m of msgs.values()) {
        const match = m.content?.match(/<@!?(\d+)>/);
        if (match) welcomedUsers.add(match[1]);
      }
      console.log(`📋 [CACHE] ${welcomedUsers.size} usuarios con bienvenida registrados.`);
    }
  } catch (err) {
    console.error("Error cargando bienvenidas previas:", err.message);
  }
}

async function sendWelcome(member) {
  try {
    const chan = member.guild.channels.cache.get(chanBienvenidaId);
    if (!chan) return;
    const id = member.user.id;
    const memberCount = member.guild.memberCount;
    const embed = {
      title: "Pan con mantequilla 🧈",
      description: `Siéntete como en casa, panita. 💛
Lee las <#1556896259846045766>, elige tus roles en <#1573415025836826658> y saluda en <#${chanNewGeneralId}>.`,
      color: 0xf3a9c0,
      footer: { text: `Miembro #${memberCount} · Pan con mantequilla × Orunei` }
    };
    let files;
    try {
      const gif = await welcomeGif({
        name: member.displayName || member.user.globalName || member.user.username,
        username: member.user.username,
        avatarUrl: member.user.displayAvatarURL({ size: 256, extension: "png" }),
        memberNumber: memberCount
      });
      files = [{ attachment: gif, name: "bienvenida.gif" }];
      embed.image = { url: "attachment://bienvenida.gif" };
    } catch (err) {
      console.error("Tarjeta de bienvenida falló, uso el banner:", err.message);
      files = [{ attachment: bienvenidaBannerPath, name: "bienvenida_banner.jpg" }];
      embed.image = { url: "attachment://bienvenida_banner.jpg" };
    }
    await chan.send({
      content: `🧈 **¡Atentos, panitas!** Acaba de llegar <@${id}>`,
      embeds: [embed],
      files,
      allowedMentions: { users: [id] }
    });
    console.log(`✅ Bienvenida enviada para @${member.user.username}`);
  } catch (err) {
    console.error("Error al enviar bienvenida:", err.message);
  }
}

async function sendLeave(member) {
  try {
    const chan = member.guild.channels.cache.get(chanDespedidaId);
    if (!chan) return;

    const avatarUrl = member.user ? member.user.displayAvatarURL({ size: 256, extension: 'png' }) : 'https://cdn.discordapp.com/embed/avatars/0.png';
    const username = member.user ? member.user.username : 'Usuario';

    await chan.send({
      embeds: [
        {
          title: "💢 UN MIEMBRO HA DEJADO EL SERVIDOR 💢",
          description: `**@${username}** ha salido del servidor o fue expulsado.\n\n*Esperamos que encuentres tu camino... o que el pan con mantequilla te vuelva a llamar algún día.*`,
          color: 0x9b59b6,
          thumbnail: { url: avatarUrl },
          image: { url: "attachment://tired_banner.jpg" },
          footer: { text: "Registro de Salidas • Pan con mantequilla" }
        }
      ],
      files: [{ attachment: despedidaBannerPath, name: "tired_banner.jpg" }]
    });

    console.log(`✅ Despedida enviada para @${username}`);
  } catch (err) {
    console.error("Error al enviar despedida:", err.message);
  }
}

// ------------------------------------------
// ANCLAJE PERMANENTE EN CANAL AFK (MODO SILENCIOSO / ENSORDECIDA)
// ------------------------------------------
let afkConnection = null;

function connectToAfkChannel(guild) {
  try {
    const afkChannel = guild.channels.cache.get(chanAfkVoiceId);
    if (!afkChannel) {
      console.warn("⚠️ Canal AFK no encontrado en el servidor.");
      return;
    }

    console.log(`💤 Conectando y anclando a PanBot en ${afkChannel.name} (Modo silencioso: ensordecida y muteada)...`);
    afkConnection = joinVoiceChannel({
      channelId: afkChannel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: true,
      selfMute: true
    });

    afkConnection.on('stateChange', (oldState, newState) => {
      console.log(`[AFK CONN] Estado: ${oldState.status} -> ${newState.status}`);
      if (newState.status === VoiceConnectionStatus.Disconnected || newState.status === VoiceConnectionStatus.Destroyed) {
        console.log("Reconectando PanBot al canal AFK en 5s...");
        setTimeout(() => {
          const g = client.guilds.cache.get(GUILD_ID);
          if (g) connectToAfkChannel(g);
        }, 5000);
      }
    });

  } catch (err) {
    console.error("Error conectando a canal AFK:", err.message);
  }
}

// ------------------------------------------
// EVENTO: BOT LISTO
// ------------------------------------------
client.once('ready', async () => {
  console.log(`🤖 ¡PanBot 24/7 ONLINE y CONECTADA como ${client.user.tag}!`);
  const guild = client.guilds.cache.get(GUILD_ID);
  if (guild) {
    await loadRecentWelcomes(guild);
    // Anclar a PanBot en AFK ensordecida y muteada
    connectToAfkChannel(guild);
  }
});

// ------------------------------------------
// EVENTO: CONEXIÓN / DESCONEXIÓN DE VOZ
// ------------------------------------------
client.on('voiceStateUpdate', async (oldState, newState) => {
  // Asegurar que PanBot permanezca en el canal de AFK ensordecida
  if (newState.member?.id === client.user.id) {
    if (!newState.channelId || newState.channelId !== chanAfkVoiceId) {
      console.log("PanBot no está en el canal AFK, retornándola al canal AFK en 3s...");
      const guild = client.guilds.cache.get(GUILD_ID);
      if (guild) {
        setTimeout(() => connectToAfkChannel(guild), 3000);
      }
    }
  }
});

// ------------------------------------------
// EVENTO: NUEVO MIEMBRO
// ------------------------------------------
client.on('guildMemberAdd', async (member) => {
  console.log(`✨ Nuevo miembro detectado: @${member.user.username}`);
  if (!welcomedUsers.has(member.user.id)) {
    welcomedUsers.add(member.user.id);
    await sendWelcome(member);
  }
});

client.on('guildMemberUpdate', async (oldMember, newMember) => {
  if (oldMember.pending && !newMember.pending && !welcomedUsers.has(newMember.user.id)) {
    welcomedUsers.add(newMember.user.id);
    console.log(`✨ Miembro completó verificación/screening: @${newMember.user.username}`);
    await sendWelcome(newMember);
  }
});

// ------------------------------------------
// EVENTO: SALIDA DE MIEMBRO
// ------------------------------------------
client.on('guildMemberRemove', async (member) => {
  console.log(`💢 Salida de miembro: @${member.user?.username || member.id}`);
  await sendLeave(member);
});

// ------------------------------------------
// EVENTO: MENSAJES (MENCIÓN EN TEXTO)
// ------------------------------------------
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const isMentioned = message.mentions.has(client.user);
  if (isMentioned) {
    await message.reply("¡Qué onda! Me encuentro en modo silencioso descansando en el canal de <#1573415508223598733> 💤. ¡Aquí sigo activa 24/7 para bienvenidas, roles y soporte del server!");
  }
});

// ------------------------------------------
// EVENTO: INTERACCIONES (SLASH COMMANDS & BOTONES)
// ------------------------------------------
client.on('interactionCreate', async (interaction) => {
  // 1. SLASH COMMANDS (/hablar, /panbot, /salir)
  if (interaction.isChatInputCommand()) {
    const cmd = interaction.commandName;

    if (cmd === 'hablar' || cmd === 'panbot') {
      return interaction.reply({
        content: "💤 ¡Hola! El modo de voz automática está pausado por los administradores. Me mantengo silenciosa y ensordecida en <#1573415508223598733> para acompañar el server sin interrumpir las partidas.",
        ephemeral: true
      });
    }

    if (cmd === 'salir') {
      return interaction.reply({
        content: "💤 PanBot ya se encuentra descansando ensordecida en el canal de AFK.",
        ephemeral: true
      });
    }
  }

  // 2. BOTONES
  if (!interaction.isButton()) return;

  const customId = interaction.customId;
  const user = interaction.user;
  const member = interaction.member;

  // BOTÓN LLAMAR PANBOT
  if (customId === "voice_call") {
    return interaction.reply({
      content: "💤 ¡Hola! El modo de voz automática está pausado por los administradores. PanBot se mantiene ensordecida y tranquila en el canal de AFK <#1573415508223598733>.",
      ephemeral: true
    });
  }

  // BOTÓN DESCONECTAR PANBOT
  if (customId === "voice_leave") {
    return interaction.reply({
      content: "💤 PanBot ya se encuentra descansando ensordecida en el canal de AFK.",
      ephemeral: true
    });
  }

  // ROLES
  if (customId.startsWith("role_")) {
    const roleId = customId.replace("role_", "");
    const hasRole = member.roles.cache.has(roleId);

    try {
      if (hasRole) {
        await member.roles.remove(roleId);
        await interaction.reply({
          content: `❌ Se te ha retirado el rol <@&${roleId}> correctamente.`,
          ephemeral: true
        });
      } else {
        await member.roles.add(roleId);
        await interaction.reply({
          content: `✅ ¡Te has asignado el rol <@&${roleId}> con éxito!`,
          ephemeral: true
        });
      }
    } catch (err) {
      console.error("Error cambiando rol:", err.message);
      await interaction.reply({
        content: `⚠️ No se pudo cambiar el rol. (Asegúrate de que el rol de PanBot esté por encima en Discord).`,
        ephemeral: true
      });
    }
    return;
  }

  // TICKETS
  if (customId.startsWith("ticket_")) {
    const ticketType = customId === "ticket_bug" 
      ? "🐛 Reporte de Bug Orunei" 
      : customId === "ticket_suggestion" 
      ? "💡 Sugerencia" 
      : "📩 Soporte General";

    // Crear el canal tarda más de 3 s: se responde "pensando…" para que Discord no caduque la interacción.
    await interaction.deferReply({ ephemeral: true }).catch(() => {});
    try {
      const staffCat = interaction.guild.channels.cache.find(
        c => c.type === ChannelType.GuildCategory && (c.name.includes("𝗦𝗧𝗔𝗙𝗙") || c.name.includes("STAFF"))
      );

      const ticketName = `ticket-${user.username.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
      const newChannel = await interaction.guild.channels.create({
        name: ticketName,
        type: ChannelType.GuildText,
        parent: staffCat ? staffCat.id : null,
        permissionOverwrites: [
          {
            id: interaction.guild.id,
            deny: [PermissionFlagsBits.ViewChannel]
          },
          {
            id: user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.AttachFiles
            ]
          }
        ]
      });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("close_ticket")
          .setLabel("Cerrar Ticket")
          .setStyle(ButtonStyle.Danger)
          .setEmoji("🔒")
      );

      await newChannel.send({
        content: `👋 ¡Hola <@${user.id}>! Tu ticket ha sido abierto para: **${ticketType}**.`,
        embeds: [
          new EmbedBuilder()
            .setTitle(`🎫 Ticket: ${ticketType}`)
            .setDescription(`Bienvenido a tu canal privado de atención.\n\nPor favor, describe tu duda o problema detalladamente.\n\nUn miembro del equipo te responderá aquí en breve.`)
            .setColor(0x3498db)
            .setFooter({ text: "Pulsa el botón de abajo cuando quieras finalizar y cerrar este ticket." })
        ],
        components: [row]
      });

      await interaction.editReply({
        content: `✅ ¡Tu ticket ha sido creado con éxito! Puedes verlo aquí: <#${newChannel.id}>`
      });

    } catch (err) {
      console.error("Error creando ticket:", err.message);
      await interaction.editReply({
        content: `❌ Ocurrió un error al crear tu ticket: ${err.message}`
      }).catch(() => {});
    }
    return;
  }

  // CERRAR TICKET
  if (customId === "close_ticket") {
    try {
      await interaction.reply({ content: "🔒 Cerrando y eliminando este ticket en 5 segundos..." });
      await sleep(5000);
      await interaction.channel.delete();
    } catch (err) {
      console.error("Error cerrando ticket:", err.message);
    }
  }
});

registerKazeFeatures(client);
registerLevels(client, { guildId: GUILD_ID, levelUpChannelId: process.env.CHANNEL_LEVELUP_ID || chanNewGeneralId, afkChannelId: chanAfkVoiceId });
// Todos los comandos se registran juntos: registrar por partes borraría los del otro módulo.
client.once(Events.ClientReady, async () => {
  const all = [...KAZE_COMMANDS, ...LEVEL_COMMANDS];
  try {
    await client.application.commands.set(all, GUILD_ID);
    console.log("[comandos] registrados:", all.map((c) => "/" + c.name).join(" "));
  } catch (e) {
    console.error("[comandos] no se pudieron registrar:", e.message);
  }
});
client.login(TOKEN).catch(console.error);
