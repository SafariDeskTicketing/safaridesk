/**
 * Text analysis utilities for Knowledge Base articles
 */

export interface TextStats {
  wordCount: number;
  characterCount: number;
  characterCountNoSpaces: number;
  paragraphCount: number;
  readingTime: number; // in minutes
  difficultyScore: number; // 0-100, where higher is more difficult
}

/**
 * Calculate comprehensive text statistics
 */
export function analyzeText(text: string): TextStats {
  if (!text || typeof text !== 'string') {
    return {
      wordCount: 0,
      characterCount: 0,
      characterCountNoSpaces: 0,
      paragraphCount: 0,
      readingTime: 0,
      difficultyScore: 0
    };
  }

  // Clean text - remove HTML tags and markdown formatting
  const cleanText = text
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold markdown
    .replace(/\*(.*?)\*/g, '$1') // Remove italic markdown
    .replace(/`(.*?)`/g, '$1') // Remove code markdown
    .replace(/#{1,6}\s/g, '') // Remove header markdown
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1'); // Remove link markdown

  // Word count
  const words = cleanText
    .trim()
    .split(/\s+/)
    .filter(word => word.length > 0);
  const wordCount = words.length;

  // Character counts
  const characterCount = text.length;
  const characterCountNoSpaces = text.replace(/\s/g, '').length;

  // Paragraph count
  const paragraphs = text
    .split(/\n\s*\n/)
    .filter(para => para.trim().length > 0);
  const paragraphCount = paragraphs.length;

  // Reading time calculation (average 200 words per minute)
  const readingTime = Math.ceil(wordCount / 200);

  // Difficulty score calculation
  const difficultyScore = calculateDifficultyScore(cleanText, words);

  return {
    wordCount,
    characterCount,
    characterCountNoSpaces,
    paragraphCount,
    readingTime,
    difficultyScore
  };
}

/**
 * Calculate text difficulty score based on various factors
 */
function calculateDifficultyScore(text: string, words: string[]): number {
  if (words.length === 0) return 0;

  let score = 0;

  // Average word length (longer words = higher difficulty)
  const avgWordLength = words.reduce((sum, word) => sum + word.length, 0) / words.length;
  score += Math.min(avgWordLength * 5, 30); // Max 30 points

  // Sentence length (longer sentences = higher difficulty)
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  if (sentences.length > 0) {
    const avgSentenceLength = words.length / sentences.length;
    score += Math.min(avgSentenceLength, 25); // Max 25 points
  }

  // Technical terms (presence of complex words)
  const technicalWords = words.filter(word => {
    return word.length > 8 || // Long words
           /[A-Z]{2,}/.test(word) || // Acronyms
           /\d/.test(word); // Contains numbers
  });
  const technicalWordRatio = technicalWords.length / words.length;
  score += technicalWordRatio * 25; // Max 25 points

  // Syllable complexity (estimated)
  const avgSyllables = estimateAverageSyllables(words);
  score += Math.min(avgSyllables * 5, 20); // Max 20 points

  return Math.min(Math.round(score), 100);
}

/**
 * Estimate average syllables per word
 */
function estimateAverageSyllables(words: string[]): number {
  if (words.length === 0) return 0;

  const totalSyllables = words.reduce((sum, word) => {
    return sum + estimateSyllables(word);
  }, 0);

  return totalSyllables / words.length;
}

/**
 * Estimate syllables in a word (simple heuristic)
 */
function estimateSyllables(word: string): number {
  if (!word || word.length === 0) return 0;
  
  word = word.toLowerCase();
  
  // Count vowel groups
  let syllables = 0;
  let previousWasVowel = false;
  
  for (let i = 0; i < word.length; i++) {
    const char = word[i];
    const isVowel = 'aeiouy'.includes(char);
    
    if (isVowel && !previousWasVowel) {
      syllables++;
    }
    
    previousWasVowel = isVowel;
  }
  
  // Handle silent 'e'
  if (word.endsWith('e') && syllables > 1) {
    syllables--;
  }
  
  // Minimum one syllable
  return Math.max(syllables, 1);
}

/**
 * Get difficulty level string from score
 */
export function getDifficultyLevel(score: number): 'beginner' | 'intermediate' | 'advanced' {
  if (score < 40) return 'beginner';
  if (score < 70) return 'intermediate';
  return 'advanced';
}

/**
 * Format reading time for display
 */
export function formatReadingTime(minutes: number): string {
  if (minutes < 1) return 'Less than 1 min';
  if (minutes === 1) return '1 min';
  return `${minutes} mins`;
}

/**
 * Extract keywords from text
 */
export function extractKeywords(text: string, maxKeywords: number = 10): string[] {
  if (!text) return [];

  // Clean and split text
  const cleanText = text
    .replace(/<[^>]*>/g, '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ');

  const words = cleanText.split(/\s+/).filter(word => word.length > 3);

  // Common stop words to filter out
  const stopWords = new Set([
    'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
    'by', 'from', 'up', 'about', 'into', 'through', 'during', 'before',
    'after', 'above', 'below', 'between', 'among', 'this', 'that', 'these',
    'those', 'they', 'them', 'their', 'what', 'which', 'who', 'when',
    'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more',
    'most', 'other', 'some', 'such', 'only', 'own', 'same', 'than', 'too',
    'very', 'can', 'will', 'just', 'should', 'now', 'also', 'then', 'there',
    'here', 'have', 'has', 'had', 'been', 'were', 'was', 'are', 'been'
  ]);

  // Count word frequency
  const wordCount = new Map<string, number>();
  words
    .filter(word => !stopWords.has(word))
    .forEach(word => {
      wordCount.set(word, (wordCount.get(word) || 0) + 1);
    });

  // Sort by frequency and return top keywords
  return Array.from(wordCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxKeywords)
    .map(([word]) => word);
}
