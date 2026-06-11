import { connectToDatabase } from "../db/mongodb.js"
import { processText } from "./textProcessor.js"
import { getRedisClient } from '../redisClient.js'

export class QuerySearcher {
  constructor(index) {
    this.index = index
  }

  async search(query, offset = 0, limit = 20) {
    const cacheKey = `${query}:${offset}:${limit}`.toLowerCase().trim()
    try {
      const client = await getRedisClient()
      const cached = await client.get(cacheKey)
      if (cached) {
        console.log(`Redis cache hit for search: ${cacheKey}!`)
        return JSON.parse(cached)
      }
      console.log(`Redis miss for search: ${cacheKey}`)
    } catch (err) {
      console.log(err.message)
    }
    const terms = processText(query)
    if (terms.length === 0) return { results: [], total: 0 }

    const db = await connectToDatabase()
    const docCount = await this.index.getDocCount()
    if (docCount === 0) return { results: [], total: 0 }

    const avgdlRes = await db.collection("metadata").findOne({ _id: "avgdl" })
    const avgdl = avgdlRes?.value || 100

    const k1 = 1.2
    const b = 0.75

    const postingDocs = new Map() // term -> { df, docTFs: Map<docId, tf> }
    const allDocIds = new Set()

    for (const term of terms) {
      const postings = await this.index.getPostings(term)
      if (!postings || typeof postings !== 'object') continue
      const df = Object.keys(postings).length
      if (df === 0) continue

      const docTFs = new Map(Object.entries(postings))
      postingDocs.set(term, { df, docTFs })
      for (const docId of docTFs.keys()) allDocIds.add(docId)
    }

    if (allDocIds.size === 0) return { results: [], total: 0 }

    const docArray = await db.collection("documents")
      .find({ _id: { $in: Array.from(allDocIds) } })
      .project({ _id: 1, title: 1, url: 1, content: 1, docLength: 1, crawledAt: 1 })
      .toArray()

    const docMap = new Map()
    for (const doc of docArray) {
      docMap.set(doc._id, doc)
    }

    const scores = {}
    for (const [term, { df, docTFs }] of postingDocs) {
      const idf = Math.log((docCount - df + 0.5) / (df + 0.5) + 1)

      for (const [docId, tf] of docTFs) {
        const doc = docMap.get(docId)
        const docLength = doc?.docLength || 100

        const numerator = tf * (k1 + 1)
        const denominator = tf + k1 * (1 - b + b * (docLength / avgdl))
        const termScore = idf * (numerator / denominator)

        scores[docId] = (scores[docId] || 0) + termScore
      }
    }

    const results = []
    for (const [docId, score] of Object.entries(scores)) {
      const doc = docMap.get(docId)
      if (doc) {
        results.push({
          id: docId,
          score: score,
          title: doc.title,
          url: doc.url,
          content: doc.content?.substring(0, 200), // optional snippet
          crawledAt: doc.crawledAt
        })
      }
    }

    const sortedResults = results.sort((a, b) => b.score - a.score)
    const paginated = sortedResults.slice(offset, offset + limit)
    const total = sortedResults.length

    try {
      const client = await getRedisClient()
      await client.setEx(cacheKey, 300, JSON.stringify({ results: paginated, total }))
    } catch (err) {
      console.log(err.message)
    }

    return { results: paginated, total }
  }
}