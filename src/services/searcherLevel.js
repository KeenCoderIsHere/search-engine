import client from "../redisClient.js"
import { processText } from "./textProcessor.js"
// Class for searching in the database for given query
export class LevelSearcher{
  constructor(index){
    // Where this index is the database which would contain all the document and term info
    this.index = index
  }
  async search(query, offset = 0, limit = 20){
    const cacheKey = `${query}`
    // Check if redis contains the query as key
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
    // Preprocess the given query
    const terms = processText(query)
    if(terms.length === 0) return []
    const docCount = await this.index.getDocCount()
    if(docCount === 0) return []
    // Scores which shows the relevance of each document to the given query
    const scores = {}
    // For each term in query
    for(const term of terms){
      // Get its postings (term -> [{doc1 -> frequency1}, {doc2 -> frequency2}, ...])
      const postings = await this.index.getPostings(term)
      // If it doesn't have any posting, skip to next term
      if (!postings || typeof postings !== 'object') {
        console.error(`Invalid postings for term: "${term}":`, postings);
        continue
      }
      // Calculate the TF-IDF score for each term 
      // Where TF is frequency of the term in a specific document
      // IDF - Inverse Document Frequency = log(total number of documents/number of documents in which term is present) -> for query terms
      // How score is calculated:
      // 1. Retrieve postings for the query term
      // 2. Calculate idf = log(total docs/docs containing query term)
      // 3. For a doc, example doc1 , its score will be the sum of all tf*idf values for all terms in the search query
      // 4. Sort the results in descending order
      const documentFreq = Object.keys(postings).length
      // In order to avoid division by zero
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
    // Cache the sorted results in the redis
    try{
      await client.setEx(cacheKey, 300, JSON.stringify(sortedResults))
    }
    catch(err){
      console.log(err)
    }
    return sortedResults
  }
}