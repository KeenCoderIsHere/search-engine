import { processText } from "./textProcessor.js"

export class Searcher{
  constructor(index){
    this.index = index
  }
  search(query){
    const terms = processText(query)
    if(terms.length == 0){
      return []
    }
    const scores = {}
    const docCount = this.index.getDocCount()
    if(docCount === 0) return []
    terms.forEach(term => {
      const postings = this.index.getPostings(term)
      const df = Object.keys(postings).length
      if(df == 0) return
      const idf = Math.log(docCount/df)
      for(const [docId, termFreq] of Object.entries(postings)){
        scores[docId] = (scores[docId] || 0) + termFreq*idf
      }
    })
    const results = Object.entries(scores).map(([docId, score]) => ({
      id: docId,
      score,
      ...this.index.getDocument(docId)
    }))
    .sort((a, b) => b.score - a.score)
    return results
  }
}