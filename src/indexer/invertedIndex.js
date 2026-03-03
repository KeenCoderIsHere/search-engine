import { processText } from "../services/textProcessor.js"

export class InvertedIndex{
  constructor(options = {}){
    this.index = {}
    this.docStore = {}
    this.docCount = 0
  }
  addDocument(docId, text, metadata = {}){
    this.docCount++
    this.docStore[docId] = { ...metadata, indexedAt: Date.now()}
    const tokens = processText(text)
    const termFreq = {}
    for(const token of tokens){
      termFreq[token] = (termFreq[token] || 0) + 1
    }
    for(const [term, termFrequency] of Object.entres(termFreq)){
      if(!this.index[term]){
        this.index[term] = {}
      }
      this.index[term][docId] = termFrequency
    }
  }
  getPostings(term){
    return this.index[term] || {}
  }
  getDocument(docId){
    return this.docStore[docId]
  }
  getDocCount(){
    return this.docCount
  }

}