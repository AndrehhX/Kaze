package com.kaze.mobile.core.text

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle

/**
 * Safe text handling. Nothing here ever executes or renders HTML: AniList descriptions are
 * reduced to plain text with bold/italic spans, and user-written posts support a tiny
 * markdown-like subset parsed by hand into AnnotatedString spans.
 */
object SafeRichText {

    private val entities = mapOf(
        "&amp;" to "&", "&lt;" to "<", "&gt;" to ">", "&quot;" to "\"", "&#039;" to "'",
        "&apos;" to "'", "&nbsp;" to " ", "&mdash;" to "—", "&ndash;" to "–", "&hellip;" to "…",
    )

    fun decodeEntities(s: String): String {
        var out = s
        entities.forEach { (k, v) -> out = out.replace(k, v) }
        return out.replace(Regex("&#(\\d+);")) { m -> m.groupValues[1].toIntOrNull()?.let { String(Character.toChars(it)) } ?: "" }
    }

    /** AniList description HTML -> plain text (paragraph breaks preserved, tags stripped). */
    fun htmlToPlain(html: String?): String {
        if (html.isNullOrBlank()) return ""
        val withBreaks = html
            .replace(Regex("(?i)<br\\s*/?>"), "\n")
            .replace(Regex("(?i)</p>"), "\n\n")
        val stripped = withBreaks.replace(Regex("<[^>]*>"), "")
        return decodeEntities(stripped)
            .replace(Regex("~!.*?!~", RegexOption.DOT_MATCHES_ALL), "[spoiler hidden]")
            .replace(Regex("\n{3,}"), "\n\n")
            .trim()
    }

    /** AniList description HTML -> AnnotatedString keeping only <i>/<b>. */
    fun htmlToAnnotated(html: String?): AnnotatedString {
        if (html.isNullOrBlank()) return AnnotatedString("")
        val src = html
            .replace(Regex("(?i)<br\\s*/?>"), "\n")
            .replace(Regex("(?i)</p>"), "\n\n")
            .replace(Regex("~!.*?!~", RegexOption.DOT_MATCHES_ALL), "[spoiler hidden]")
        val tag = Regex("(?i)<(/?)(i|b|em|strong)>|<[^>]*>")
        return buildAnnotatedString {
            var italic = 0
            var bold = 0
            var last = 0
            fun flush(end: Int) {
                if (end <= last) return
                val text = decodeEntities(src.substring(last, end))
                if (italic == 0 && bold == 0) { append(text); return }
                val style = SpanStyle(
                    fontStyle = if (italic > 0) FontStyle.Italic else null,
                    fontWeight = if (bold > 0) FontWeight.SemiBold else null,
                )
                withStyle(style) { append(text) }
            }
            tag.findAll(src).forEach { m ->
                flush(m.range.first)
                last = m.range.last + 1
                val closing = m.groupValues[1] == "/"
                when (m.groupValues[2].lowercase()) {
                    "i", "em" -> italic = (italic + if (closing) -1 else 1).coerceAtLeast(0)
                    "b", "strong" -> bold = (bold + if (closing) -1 else 1).coerceAtLeast(0)
                }
            }
            flush(src.length)
        }.let { trimAnnotated(it) }
    }

    private fun trimAnnotated(a: AnnotatedString): AnnotatedString {
        val start = a.text.indexOfFirst { !it.isWhitespace() }.coerceAtLeast(0)
        val end = a.text.indexOfLast { !it.isWhitespace() } + 1
        return if (end <= start) AnnotatedString("") else a.subSequence(start, end)
    }

    /**
     * User content: **bold**, *italic* / _italic_, `code`, ||inline spoiler||.
     * Spoilers are drawn as solid blocks (text colour == background) until [revealSpoilers].
     */
    fun markdownLite(
        input: String,
        revealSpoilers: Boolean,
        spoilerColor: Color,
        codeBackground: Color,
    ): AnnotatedString {
        val text = input.take(MAX_LENGTH)
        val token = Regex("\\*\\*(.+?)\\*\\*|\\|\\|(.+?)\\|\\||`([^`]+)`|\\*(.+?)\\*|_(.+?)_")
        return buildAnnotatedString {
            var last = 0
            token.findAll(text).forEach { m ->
                append(text.substring(last, m.range.first))
                val (bold, spoiler, code, italicA, italicB) = m.destructured
                when {
                    bold.isNotEmpty() -> withStyle(SpanStyle(fontWeight = FontWeight.Bold)) { append(bold) }
                    spoiler.isNotEmpty() -> if (revealSpoilers) {
                        withStyle(SpanStyle(background = spoilerColor.copy(alpha = 0.18f))) { append(spoiler) }
                    } else {
                        withStyle(SpanStyle(color = spoilerColor, background = spoilerColor)) { append(spoiler) }
                    }
                    code.isNotEmpty() -> withStyle(SpanStyle(fontFamily = FontFamily.Monospace, background = codeBackground)) { append(code) }
                    italicA.isNotEmpty() -> withStyle(SpanStyle(fontStyle = FontStyle.Italic)) { append(italicA) }
                    italicB.isNotEmpty() -> withStyle(SpanStyle(fontStyle = FontStyle.Italic)) { append(italicB) }
                }
                last = m.range.last + 1
            }
            append(text.substring(last))
        }
    }

    fun containsInlineSpoiler(input: String): Boolean = Regex("\\|\\|(.+?)\\|\\|").containsMatchIn(input)

    /** Validation for anything a user types that will be stored and shown to others. */
    fun sanitizeUserInput(input: String, maxLength: Int = MAX_LENGTH): String =
        input
            .replace(Regex("[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F]"), "")
            .replace(Regex("[\\u202A-\\u202E\\u2066-\\u2069]"), "") // bidi overrides
            .trim()
            .take(maxLength)

    const val MAX_LENGTH = 4000
}
