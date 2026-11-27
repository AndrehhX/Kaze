import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Condiciones de uso",
  description: "Las reglas para usar Orunei (KAZE): tu cuenta, lo que publicas y el contenido de la plataforma.",
  alternates: { canonical: "/terminos" },
};

export default function TerminosPage() {
  return (
    <LegalPage
      title="Condiciones de uso"
      updated="27 de noviembre de 2026"
      intro={<p>Al crear una cuenta o usar Orunei (KAZE) aceptas estas condiciones. Son cortas a propósito: léelas.</p>}
    >
      <LegalSection title="Tu cuenta">
        <ul>
          <li>Eres responsable de lo que se hace con tu cuenta. Usa una contraseña segura y no la compartas.</li>
          <li>Da datos reales al registrarte y no te hagas pasar por otra persona.</li>
          <li>
            Puedes borrar tu cuenta cuando quieras en{" "}
            <Link className="text-primary-ink underline" href="/settings/privacy">
              Ajustes → Privacidad
            </Link>
            .
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Lo que publicas">
        <p>Tus reseñas, comentarios, mensajes y tu perfil son tuyos. Al publicarlos nos das permiso para mostrarlos en la plataforma. No está permitido:</p>
        <ul>
          <li>Acosar, amenazar o discriminar a otras personas.</li>
          <li>Publicar spam, estafas, enlaces maliciosos o contenido sexual explícito.</li>
          <li>Publicar spoilers sin avisar donde no corresponde.</li>
          <li>Intentar romper, sobrecargar o saltarse la seguridad de la plataforma.</li>
        </ul>
        <p>Podemos ocultar contenido o suspender cuentas que no respeten estas reglas. Puedes reportar contenido desde la propia plataforma.</p>
      </LegalSection>

      <LegalSection title="El contenido de la plataforma">
        <ul>
          <li>La información de los animes (títulos, portadas, sinopsis) viene de AniList y de sus fuentes, y pertenece a sus respectivos dueños.</li>
          <li>Los mangas se muestran a través de MangaDex y otras fuentes de terceros.</li>
          <li>
            Si eres titular de derechos y crees que algún contenido no debería estar aquí, escríbenos por nuestro servidor de Discord con los detalles y lo revisaremos y retiraremos si corresponde.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="El servicio">
        <ul>
          <li>Orunei es un proyecto gratuito. Hacemos lo posible para que funcione bien, pero puede haber caídas, errores o cambios sin aviso.</li>
          <li>Podemos cambiar, añadir o quitar funciones en cualquier momento.</li>
          <li>El servicio se ofrece &quot;tal cual&quot;: en la medida en que la ley lo permita, no respondemos por daños derivados de su uso.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Privacidad">
        <p>
          Cómo tratamos tus datos está en la{" "}
          <Link className="text-primary-ink underline" href="/privacidad">
            Política de privacidad
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection title="Cambios">
        <p>Si cambiamos estas condiciones de forma importante, lo avisaremos en la plataforma. Seguir usándola después significa que aceptas la nueva versión.</p>
      </LegalSection>
    </LegalPage>
  );
}
