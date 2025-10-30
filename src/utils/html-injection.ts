/**
 * Injects content before </head> or </body> tag
 * If neither tag is found, appends the content at the end
 */
export function injectIntoHTML(html: string, content: string): string {
  if (html.includes('</head>')) {
    return html.replace('</head>', `${content}</head>`)
  } else if (html.includes('</body>')) {
    return html.replace('</body>', `${content}</body>`)
  } else {
    return html + content
  }
}
