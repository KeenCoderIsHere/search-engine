import client from "../redisClient.js"
import { processText } from "./textProcessor.js"

export class LevelSearcher{
  constructor(index){
    this.index = index
  }
  async search(query, offset = 0, limit = 20){
    const cacheKey = `${query}`
    try{
      const cached = await client.get(cacheKey)
      if(cached){
        console.log(`Redis cache hit for search: ${cacheKey}!`)
        return JSON.parse(cached)
      }
    }
    catch(err){
      console.log(err)
    }
    console.log(`Redis miss for search: ${cacheKey}`)
    const terms = processText(query)
    if(terms.length === 0) return []
    const docCount = await this.index.getDocCount()
    if(docCount === 0) return []
    const scores = {}
    for(const term of terms){
      const postings = await this.index.getPostings(term)
      if (!postings || typeof postings !== 'object') {
        console.error(`Invalid postings for term: "${term}":`, postings);
        continue
      }
      const documentFreq = Object.keys(postings).length
      if(documentFreq === 0) continue 
      const idf = Math.log(docCount/documentFreq)
      for(const [docId, tf] of Object.entries(postings)){
        scores[docId] = (scores[docId] || 0 ) + tf*idf
      }
    }
    const results = []
    for(const [docId, score] of Object.entries(scores)){
      const metadata = await this.index.getDocument(docId)
      if(metadata){
        results.push({
          id: docId,
          score: score,
          ...metadata
        })
      }
    }
    const sortedResults = results.sort((a,b) => b.score - a.score)
    try{
      await client.setEx(cacheKey, 300, JSON.stringify(sortedResults))
    }
    catch(err){
      console.log(err)
    }
    return sortedResults
  }
}