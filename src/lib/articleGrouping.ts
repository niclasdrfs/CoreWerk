/**
 * Recursive article grouping algorithm.
 * Groups articles by successive TEXT words in their name to create a virtual folder structure.
 * Numeric/size words (M8, 30x5, etc.) are skipped for grouping.
 */

export interface GroupedItem {
  type: "folder";
  word: string;
  count: number;
  articles: any[];
}

export interface SingleItem {
  type: "article";
  product: any;
}

export type GroupEntry = GroupedItem | SingleItem;

/**
 * Check if a word is numeric/size-like and should NOT be used for folder grouping.
 * Matches: pure numbers (123), dimensions (30x5, M8x30), sizes (M8, M10), decimals, units, etc.
 */
function isNumericWord(word: string): boolean {
  // Pure numbers, decimals, fractions
  if (/^[\d.,xX×*\-/]+$/.test(word)) return true;
  // Letter prefix + numbers like M8, M10, S235, R10
  if (/^[A-Za-z]{0,2}\d+/.test(word)) return true;
  return false;
}

/**
 * Extract only text (non-numeric) words from an article name.
 */
function getTextWords(name: string): string[] {
  // Split on whitespace AND hyphens to handle names like "VKR-20" → ["VKR", "20"]
  return name.split(/[\s\-]+/).filter((w) => w && !isNumericWord(w));
}

/**
 * Given a list of articles and a text-word index, group articles by the text word at that position.
 * Numeric words are skipped entirely for grouping purposes.
 */
export function groupByWordIndex(articles: any[], wordIndex: number): GroupEntry[] {
  if (articles.length === 0) return [];

  const groups = new Map<string, any[]>();
  const noWord: any[] = [];

  for (const article of articles) {
    const textWords = getTextWords(article.name);
    const word = textWords[wordIndex];
    if (!word) {
      noWord.push(article);
    } else {
      if (!groups.has(word)) groups.set(word, []);
      groups.get(word)!.push(article);
    }
  }

  const result: GroupEntry[] = [];

  // Sort folder names alphabetically
  const sortedKeys = [...groups.keys()].sort((a, b) => a.localeCompare(b, "de"));

  for (const word of sortedKeys) {
    const group = groups.get(word)!;
    if (group.length === 1) {
      result.push({ type: "article", product: group[0] });
    } else {
      result.push({
        type: "folder",
        word,
        count: group.length,
        articles: group,
      });
    }
  }

  for (const a of noWord) {
    result.push({ type: "article", product: a });
  }

  return result;
}

/**
 * Check if a group of articles can be further subdivided at the given text-word index.
 */
function hasSubgroups(articles: any[], wordIndex: number): boolean {
  const words = new Set<string>();
  let hasWord = false;

  for (const article of articles) {
    const textWords = getTextWords(article.name);
    const w = textWords[wordIndex];
    if (w) {
      hasWord = true;
      words.add(w);
    }
  }

  return hasWord && (words.size >= 2 || articles.some(a => !getTextWords(a.name)[wordIndex]));
}

/**
 * Filter articles within a path: returns only articles whose TEXT words match the path.
 */
export function getArticlesAtPath(allArticles: any[], path: string[]): any[] {
  if (path.length === 0) return allArticles;

  return allArticles.filter((article) => {
    const textWords = getTextWords(article.name);
    return path.every((p, i) => textWords[i] === p);
  });
}
