import { Level } from "level";
import { processText } from "../services/textProcessor.js";

// Create a inverted index for all terms using the LevelDB database for persistence
export class LevelDBIndex{
  // Constructor to create a new LevelDB database and its instance
  constructor(dbPath){
    this.db = new Level(dbPath, {valueEncoding: 'json'})
  }
  // Open the LevelDB database 
  async open(){
    await this.db.open()
  }
  // Add a document to the database
  async addDocument(docId, text, metadata = {}){
    // The database will contain two type of entries: 
    // 1. key: doc:docId, value: metadata (which contains page title, url, links and time at which it was crawled)
    // 2. key: term:term, value: docId:frequency for all documents (postings)
    await this.db.put(`doc:${docId}`, {
      ...metadata,
      indexedAt: Date.now()
    })
    // Preprocess the text content given
    const terms = processText(text)
    const termFrequency = {}
    // Find each term and its frequency
    for(const term of terms){
      termFrequency[term] = (termFrequency[term] || 0) + 1
    }
    // For each term in the processed tokens add its postings 
    for(const [term, frequency] of Object.entries(termFrequency)){
      let postings = {}
      try{
        // if the term already exists in the database, get its postings
        // posting = docId:frequency
        postings = await this.db.get(`term:${term}`)
      }
      catch(err){
        if (err.code !== 'LEVEL_NOT_FOUND') throw err
      }
      // else initialize empty postings
      if (!postings || typeof postings !== 'object') {
        postings = {}
      }
      // posting = docId:frequency
      postings[docId] = frequency
      await this.db.put(`term:${term}`,postings)
    }
  }
  // Get postings for a term
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
  // Get information about a document using its docId
  async getDocument(docId){
    try{ 
      return await this.db.get(`doc:${docId}`)
    }
    catch(err){
      console.error(err)
      return null
    }
  }
  // Get all document information [using prefix 'doc:'] (or) term information [using prefix 'term:'] (or) all 
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
  // Get number of documents
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
  // Close the database using its instance
  async close(){
    await this.db.close()
  }
}