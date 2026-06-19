const MAX_DIFF_CHARS = 50000

export function truncateDiff(diffContent: string, maxChars = MAX_DIFF_CHARS) {
  if (diffContent.length <= maxChars) {
    return {
      content: diffContent,
      truncated: false,
    }
  }

  return {
    content: diffContent.slice(0, maxChars),
    truncated: true,
  }
}
