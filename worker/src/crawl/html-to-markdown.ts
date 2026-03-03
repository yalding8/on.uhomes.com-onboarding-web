/**
 * HTML → Markdown 转换器
 *
 * 将页面 HTML 转换为结构化 Markdown，保留标题层级、列表、链接、表格。
 * 移除导航、页脚等噪音元素。输出用于 LLM 提取时比纯 innerText 更精准。
 */

/** 在浏览器上下文中执行，将 DOM 转换为 Markdown */
export function htmlToMarkdownBrowserScript(): string {
  return `(() => {
    const clone = document.body.cloneNode(true);
    const REMOVE = ['script','style','nav','footer','header','noscript','iframe','svg','form'];
    for (const sel of REMOVE) {
      clone.querySelectorAll(sel).forEach(el => el.remove());
    }

    function walk(node) {
      if (node.nodeType === 3) return node.textContent || '';
      if (node.nodeType !== 1) return '';
      const el = node;
      const tag = el.tagName.toLowerCase();
      const children = Array.from(el.childNodes).map(walk).join('');
      const text = children.trim();
      if (!text) return '';

      switch (tag) {
        case 'h1': return '\\n# ' + text + '\\n';
        case 'h2': return '\\n## ' + text + '\\n';
        case 'h3': return '\\n### ' + text + '\\n';
        case 'h4': return '\\n#### ' + text + '\\n';
        case 'h5': return '\\n##### ' + text + '\\n';
        case 'h6': return '\\n###### ' + text + '\\n';
        case 'p': return '\\n' + text + '\\n';
        case 'br': return '\\n';
        case 'hr': return '\\n---\\n';
        case 'strong': case 'b': return '**' + text + '**';
        case 'em': case 'i': return '_' + text + '_';
        case 'a': {
          const href = el.getAttribute('href') || '';
          if (!href || href === '#') return text;
          return '[' + text + '](' + href + ')';
        }
        case 'li': return '- ' + text + '\\n';
        case 'ul': case 'ol': return '\\n' + children + '\\n';
        case 'td': case 'th': return ' ' + text + ' |';
        case 'tr': return '|' + children + '\\n';
        case 'table': return '\\n' + children + '\\n';
        case 'img': {
          const alt = el.getAttribute('alt') || '';
          const src = el.getAttribute('src') || el.getAttribute('data-src') || '';
          if (!src || src.startsWith('data:')) return '';
          return '![' + alt + '](' + src + ')';
        }
        case 'div': case 'section': case 'article': case 'main':
          return '\\n' + text + '\\n';
        default:
          return text;
      }
    }

    let md = walk(clone);
    // Clean up excessive newlines
    md = md.replace(/\\n{3,}/g, '\\n\\n').trim();
    return md;
  })()`;
}

/**
 * 从服务端 HTML 字符串转换为 Markdown（不需要浏览器的简易版本）
 * 用于静态站点的快速提取路径
 */
export function simpleHtmlToMarkdown(html: string): string {
  let text = html;

  // Remove unwanted elements
  text = text.replace(
    /<(script|style|nav|footer|header|noscript|iframe|svg)[^>]*>[\s\S]*?<\/\1>/gi,
    "",
  );

  // Convert headings
  text = text.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "\n# $1\n");
  text = text.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "\n## $1\n");
  text = text.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "\n### $1\n");
  text = text.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, "\n#### $1\n");

  // Convert links
  text = text.replace(
    /<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi,
    "[$2]($1)",
  );

  // Convert lists
  text = text.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "- $1\n");

  // Convert paragraphs and breaks
  text = text.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, "\n$1\n");
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<hr\s*\/?>/gi, "\n---\n");

  // Convert bold/italic
  text = text.replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, "**$2**");
  text = text.replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi, "_$2_");

  // Strip remaining tags
  text = text.replace(/<[^>]+>/g, "");

  // Decode entities
  text = text.replace(/&amp;/g, "&");
  text = text.replace(/&lt;/g, "<");
  text = text.replace(/&gt;/g, ">");
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&nbsp;/g, " ");

  // Clean up whitespace
  text = text.replace(/\n{3,}/g, "\n\n").trim();

  return text;
}
