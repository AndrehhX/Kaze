import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Política de privacidad",
  description: "Qué datos guarda Orunei (KAZE), para qué los usa, con quién los comparte y cómo borrarlos.",
  alternates: { canonical: "/privacidad" },
};

export default function PrivacidadPage() {
  return (
    <LegalPage
      title="Política de privacidad"
      updated="27 de noviembre de 2026"
      intro={
        <p>
          Orunei (KAZE) es una plataforma para descubrir, seguir y ver anime y manga. Aquí te contamos, sin letra pequeña, qué datos guardamos, para qué y cómo puedes borrarlos. No vendemos tus datos ni
          mostramos publicidad basada en ellos.
        </p>
      }
    >
      <LegalSection title="Qué datos guardamos">
        <ul>
          <li>
            <strong>Tu cuenta:</strong> correo electrónico y nombre de usuario. Si entras con Google, recibimos tu correo, tu nombre y tu foto de perfil de Google; no recibimos tu contraseña ni otros datos de tu
            cuenta de Google.
          </li>
          <li>
            <strong>Tu actividad en la plataforma:</strong> tu biblioteca, listas, progreso de episodios y capítulos, reseñas, comentarios, amigos, salas de visionado y la personalización de tu perfil.
          </li>
          <li>
            <strong>Avisos:</strong> si activas las notificaciones del navegador o de la app, guardamos la suscripción técnica necesaria para enviártelas.
          </li>
          <li>
            <strong>Cuentas conectadas:</strong> si conectas AniList, guardamos el permiso de acceso cifrado para sincronizar tu lista.
          </li>
          <li>
            <strong>Si apoyas en Ko-fi:</strong> recibimos de Ko-fi el aviso del pago (importe, nivel, tu nombre en Ko-fi, el mensaje y el correo que usaste) para activar tus cosméticos. Nunca vemos tus
            datos de tarjeta ni de PayPal.
          </li>
          <li>
            <strong>Estadísticas anónimas:</strong> contamos visitas y uso general (páginas vistas, país, tipo de dispositivo) sin cookies de seguimiento y sin identificarte. En la app puedes apagarlas en
            Ajustes.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Para qué los usamos">
        <ul>
          <li>Darte acceso a tu cuenta y guardar tu progreso en todos tus dispositivos.</li>
          <li>Mostrarte recomendaciones y avisos de episodios nuevos de lo que sigues.</li>
          <li>Enviarte correos de la cuenta (confirmación, recuperar contraseña) y, si no lo desactivas, un resumen semanal con los episodios nuevos de lo que sigues.</li>
          <li>Mantener la plataforma segura (evitar abusos y spam) y entender qué funciones se usan para mejorarlas.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Con quién los compartimos">
        <p>Solo con los servicios que necesitamos para que la plataforma funcione, y solo lo necesario:</p>
        <ul>
          <li>
            <strong>Supabase</strong>: base de datos y cuentas.
          </li>
          <li>
            <strong>Cloudflare</strong>: red de entrega y protección contra ataques.
          </li>
          <li>
            <strong>Brevo</strong>: envío de correos.
          </li>
          <li>
            <strong>Umami</strong>: estadísticas anónimas.
          </li>
          <li>
            <strong>Google</strong>: solo si eliges entrar con Google.
          </li>
          <li>
            <strong>AniList</strong>: solo si conectas tu cuenta de AniList.
          </li>
          <li>
            <strong>Ko-fi</strong>: solo si eliges apoyar; ellos procesan el pago.
          </li>
        </ul>
        <p>Lo que publicas a propósito (reseñas, comentarios, tu perfil público) lo pueden ver otras personas según tu configuración de privacidad.</p>
      </LegalSection>

      <LegalSection title="Tus opciones">
        <ul>
          <li>
            Controla quién ve tu perfil y tu actividad en{" "}
            <Link className="text-primary-ink underline" href="/settings/privacy">
              Ajustes → Privacidad
            </Link>
            .
          </li>
          <li>Desactiva el resumen semanal desde el panel de notificaciones o con el enlace al pie de cualquier resumen.</li>
          <li>
            <strong>Borra tu cuenta y todos tus datos</strong> cuando quieras en{" "}
            <Link className="text-primary-ink underline" href="/settings/privacy">
              Ajustes → Privacidad → Eliminar cuenta
            </Link>
            . Se borran tu perfil, biblioteca, reseñas, comentarios, amigos y cuentas conectadas, y no se puede deshacer.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Cookies">
        <p>Solo usamos las cookies necesarias para mantener tu sesión iniciada. Tus preferencias (tema, idioma de audio, etc.) se guardan en tu propio navegador.</p>
      </LegalSection>

      <LegalSection title="Menores de edad">
        <p>Orunei no está dirigido a menores de 13 años. Si eres menor de edad, usa la plataforma con permiso de tu madre, padre o tutor.</p>
      </LegalSection>

      <LegalSection title="Cambios">
        <p>Si cambiamos esta política de forma importante, lo avisaremos en la plataforma. La fecha de arriba indica la última versión.</p>
      </LegalSection>
    </LegalPage>
  );
}
