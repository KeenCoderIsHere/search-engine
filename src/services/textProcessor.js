import { removeStopwords } from 'stopword'
import { stemmer } from 'stemmer'
function tokenize (text) {
  return text.toLowerCase().match(/\b[\w']+\b/g) || []
}
export function processText(text){
  // if text is empty, return empty array
  if(!text || text.length <= 0 || typeof text !== "string") return []
  // convert to lowercase, split using space, remove stopwords, reduce to its root word and then return
  const lower = text.toLowerCase()
  const tokens = tokenize(lower)
  const cleanedTokens = removeStopwords(tokens)
  const rootWord = cleanedTokens.map(token => stemmer(token))
  return rootWord
}