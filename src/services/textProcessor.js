import { removeStopwords } from 'stopword'
import { stemmer } from 'stemmer'
function tokenize (text) {
  return text.toLowerCase().match(/\b[\w']+\b/g) || []
}
export function processText(text){
  if(!text || text.trim().length <= 0 || typeof text !== "string") return []

  const lower = text.toLowerCase()
  const tokens = tokenize(lower)
  const cleanedTokens = removeStopwords(tokens)
  const rootWord = cleanedTokens.map(token => stemmer(token))
  return rootWord
}