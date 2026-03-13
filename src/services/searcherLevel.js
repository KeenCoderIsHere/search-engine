import { connectToDatabase } from "../db/mongodb.js"
import client from "../redisClient.js"
import { processText } from "./textProcessor.js"

export class LevelSearcher{
  constructor(index){
    this.index = index
  }
  async search(query){
    const cacheKey = `${query}`.toLowerCase().trim()
    try{
      const cached = await client.get(cacheKey)
      if(cached){
        console.log(`Redis cache hit for search: ${cacheKey}!`)
        return JSON.parse(cached)
      }
    }
    catch(err){
      console.log(err.message)
    }
    console.log(`Redis miss for search: ${cacheKey}`)
    const terms = processText(query)
    if(terms.length === 0) return []
    const docCount = await this.index.getDocCount()
    const db = await connectToDatabase()
    const res = await db.collection("metadata").findOne({
      _id: "avgdl"
    })
    let avgdl = 100
    if(res && res.value){
      avgdl = res.value
    }
    else{
      console.log(`Failed to fetch average document value!`)
    }
    const k1 = 1.2
    const b = 0.75
    if(docCount === 0) return []
    const scores = {}
    for(const term of terms){
      const postings = await this.index.getPostings(term)
      if (!postings || typeof postings !== 'object') {
        console.error(`Invalid postings for term: "${term}":`, postings);
        continue
      }
      const df = Object.keys(postings).length

      if(df === 0) continue 

      const idf = Math.log((docCount - df + 0.5) / (df + 0.5) + 1)

      for(const [docId, tf] of Object.entries(postings)){
        const docData = await this.index.getDocument(docId)
        let docLength = 100
        if(docData && docData.docLength){
          docLength = docData.docLength
        }
        const numerator = tf * (k1 + 1)
        const denominator = tf + k1 * ( 1 - b + b * ( docLength/avgdl ))
        const termScore = idf * (numerator/denominator)
        scores[docId] = (scores[docId] || 0 ) + termScore
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
      console.log(err.message)
    }
    return sortedResults
  }
}