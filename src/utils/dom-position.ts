/**
 * Position type for element insertion
 */
export type InsertPosition = 'before' | 'after' | 'prepend' | 'append'

/**
 * Inserts content at the specified position relative to a target element
 * Used for regex-based HTML string manipulation
 *
 * @param position - Where to insert the content
 * @param content - The content to insert
 * @param match - The full matched element string
 * @param openTag - The opening tag of the matched element
 * @param innerContent - The inner content of the matched element
 * @param closeTag - The closing tag of the matched element
 * @returns The modified HTML string with content inserted
 */
export function insertAtPosition(
  position: InsertPosition,
  content: string,
  match: string,
  openTag: string,
  innerContent: string,
  closeTag: string
): string {
  switch (position) {
    case 'before':
      return `${content}${match}`
    case 'after':
      return `${match}${content}`
    case 'prepend':
      return `${openTag}${content}${innerContent}${closeTag}`
    case 'append':
    default:
      return `${openTag}${innerContent}${content}${closeTag}`
  }
}

/**
 * Inserts an element at the specified position relative to a target element
 * For use with linkedom/DOM API
 *
 * @param position - Where to insert the element
 * @param element - The element to insert
 * @param target - The target element to insert relative to
 */
export function insertElementAtPosition(
  position: InsertPosition,
  element: Element,
  target: Element
): void {
  switch (position) {
    case 'before':
      target.parentNode?.insertBefore(element, target)
      break
    case 'after':
      target.parentNode?.insertBefore(element, target.nextSibling)
      break
    case 'prepend':
      target.insertBefore(element, target.firstChild)
      break
    case 'append':
    default:
      target.appendChild(element)
      break
  }
}
