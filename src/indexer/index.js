import { processText } from "../services/textProcessor.js"

export class MongoDBIndex{
  constructor(db){
    this.db = db
  }
  async getDocument(docId){
    const document = await this.db.collection("documents").findOne({
      _id: docId
    })
    return document
  }
  async addDocument(docId, content, metadata = {}){
    const terms = processText(content)
    const docLength = terms.length
    const termFrequency = {}
    for(const term of terms){
      termFrequency[term] = (termFrequency[term] || 0) + 1
    }
    try{
      await this.db.collection("documents").updateOne(
        { _id: docId },
        { $set: {
          ...metadata, 
          content: content,
          docLength: docLength,
          crawledAt: new Date()
        }},
        { upsert: true}
      )
      const bulkOps = Object.entries(termFrequency).map(([term, frequency]) => ({
        updateOne: {
          filter: { term, docId },
          update: { $set: { tf: frequency } },
          upsert: true
        }
      }))
      if(bulkOps.length > 0){
        await this.db.collection("postings").bulkWrite(bulkOps, { ordered: false })
      }
    }
    catch(err){
      console.error(err.message)
    }
  }
  async getPostings(term){
    try{
      const data = await this.db.collection('postings').find({
        term: term
      })
      let postings = {}
      await data.forEach(doc => {
        postings[doc.docId] = doc.tf
      })
      return postings
    }
    catch(err){
      console.error(err.message)
      return {}
    }
  }
  async getDocCount(){
    try{
      return this.db.collection("documents").countDocuments()
    }
    catch(err){
      console.error(err.message)
    }
  }
  async ensureIndexes() {
    await this.db.collection("postings").createIndex(
      { term: 1, docId: 1 },
      { unique: true }
    )
    await this.db.collection("postings").createIndex({ term: 1 })
    await this.db.collection("documents").createIndex({ crawledAt: 1 })
  }
}
