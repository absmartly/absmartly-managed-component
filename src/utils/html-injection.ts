/**
 * Injects content before </head> or </body> tag
 * If neither tag is found, appends the content at the end
 *
 * IMPORTANT: Uses replacement function to avoid $ special character issues
 * (In string replacements, $ has special meaning: $& = matched text, $$ = literal $)
 */
export function injectIntoHTML(html: string, content: string): string {
  if (html.includes('</head>')) {
    return html.replace('</head>', () => `${content}</head>`)
  } else if (html.includes('</body>')) {
    return html.replace('</body>', () => `${content}</body>`)
  } else {
    return html + content
  }
}
