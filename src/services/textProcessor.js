import natural from 'natural'
import { removeStopwords } from 'stopword'
import stemmer from 'stemmer' 
const tokenizer = new natural.WordTokenizer()

export function processText(text){
  if(!text || text.trim().length <= 0 || typeof text !== "string") return []

  const lower = text.toLowerCase()
  const tokens = tokenizer.tokenize(lower)
  const cleanedTokens = removeStopwords(tokens)
  const rootWord = cleanedTokens.map(token => stemmer(token))
  return rootWord
}