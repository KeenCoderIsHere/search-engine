import { Level } from "level";
import { processText } from "../services/textProcessor.js";

export class LevelDBIndex{
  constructor(dbPath){
    this.db = new Level(dbPath, {valueEncoding: 'json'})
  }
  async addDocument(docId, text, metadata = {}){
    await this.db.put(`doc:${docId}`, {
      ...metadata,
      indexedAt: Date.now()
    })
    const terms = processText(text)
    const termFrequency = {}
    for(const term of terms){
      termFrequency[term] = (termFrequency[term] || 0) + 1
    }
    for(const [term, frequency] of Object.entries(termFrequency)){
      let postings = {}
      try{
        postings = await this.db.get(`term:${term}`)
      }
      catch(err){
        if (err.code !== 'LEVEL_NOT_FOUND') throw err
      }
      if (!postings || typeof postings !== 'object') {
        postings = {}
      }
      postings[docId] = frequency
      await this.db.put(`term:${term}`,postings)
    }
  }
  async getPostings(term){
    try{
      const result = await this.db.get(`term:${term}`)
      return (result && typeof result === 'object') ? result : {};
    }
    catch(err){
      console.log(err)
      return {}
    }
  }
  async getDocument(docId){
    try{ 
      return await this.db.get(`doc:${docId}`)
    }
    catch(err){
      console.error(err)
      return null
    }
  }
  async getAllTerms(prefix = ''){
    try{
      const iterator = this.db.iterator({
        gte: prefix,
        lt: '\uffff',
        keys: true,
        values: false
      })
      const terms = []
      for await(const [key, value] of iterator){
        terms.push(key)
      }
      return terms
    }
    catch(err){
      console.error(err)
    }
  }
  async getDocCount(){
    let count = 0
    const iterator = this.db.iterator({
      gte: 'doc:',
      lt: 'doc:'+'\uffff',
      keys: true,
      values: false
    })
    for await(const _ of iterator){
      ++count
    }
    return count
  }
  async close(){
    this.db.close()
  }
}