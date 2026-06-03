import pLimit from "p-limit"
import normalizeUrl from "normalize-url"
import { Crawler } from "./crawler/crawler.js"
import axios from "axios"
import robotsParser from "robots-parser"

export class AutonomousCrawler{
  constructor(options = {}){
    this.concurrency = options.concurrency || 2
    this.maxPages = options.maxPages || 100
    this.userAgent = options.userAgent || 'Search-Engine'
    this.delay = options.delay || 1000
    this.pagesCrawled = 0
    this.limit = pLimit(this.concurrency)
    this.activeTasks = []
    this.shouldStop = false
    this.lastRequest = new Map()
    this.crawlPromise = null
    this.robotsCache = new Map()
    this.fresh = options.fresh || false
    this.crawler = new Crawler({delay: 0})
    this.db = options.db || null
    this.index = options.index || null
    if (!this.db) throw new Error('AutonomousCrawler requires an db instance')
  }
  async queueSize(){
    return this.db.collection("crawler_queue").countDocuments()
  }
  async crawlUrl(url){
    if(this.shouldStop) return
    const page = await this.crawler.crawlPage(url)
    if(!page){
      await this.markVisited(url, 404)
      console.log(`${url} not found.`)
      return
    }
    if(this.shouldStop){
      await this.markVisited(url, 200)
      return
    }
    await this.index.addDocument(page.id, page.content, {
      title: page.title,
      url: page.url,
      crawledAt: Date.now(),
      links: page.links,
      content: page.content
    })
    this.pagesCrawled++
    console.log(`${this.pagesCrawled}/${this.maxPages} ${page.title}`)
    if(this.pagesCrawled < this.maxPages && !this.shouldStop){
      await Promise.all(page.links.map(link => this.enqueue(link)))
    }
    await this.markVisited(url, 200)
  }
  async stop(){
    console.log(`Stopping crawler.`)
    this.shouldStop = true
    if(this.activeTasks.length > 0){
    console.log(`Waiting for ${this.activeTasks.length} active tasks...`)
    await Promise.all(this.activeTasks)
    }
    console.log(`Crawler stopped. Pages crawled ${this.pagesCrawled}`)
  }
  normalizeUrl(url){
    return normalizeUrl(url, {
      stripHash: true,
      stripWWW: true,
      removeTrailingSlash: true,
      removeQueryParameters: [/.*/]
    })
  }
  async enqueue(url){
    const normalizedUrl = this.normalizeUrl(url)
    const visited = await this.db.collection("crawler_visited").findOne({
      _id: normalizedUrl
    })
    if(visited) return
    const queued = await this.db.collection("crawler_queue").findOne({
      _id: normalizedUrl
    })
    if(queued) return
    await this.db.collection("crawler_queue").insertOne({
      _id: normalizedUrl,
      url: normalizedUrl,
      addedAt: new Date()
    }).catch(() => {})
  }
  async dequeue(){
    const result = await this.db.collection("crawler_queue").findOneAndDelete(
      {},
      { sort: { addedAt: 1 }}
    )
    return result ? result.url : null
  }
  async markVisited(url, status = 200){
    const normalizedUrl = this.normalizeUrl(url)
    await this.db.collection("crawler_queue").findOneAndDelete({
      _id: normalizedUrl
    })
    await this.db.collection("crawler_visited").updateOne(
      { _id: normalizedUrl },
      { $set: { lastCrawled: new Date(), status }},
      { upsert: true }
    )
  }
  async startSeed(seedUrls) {
    const start = Date.now()
    this.crawlPromise = (async () => {
      if(this.fresh){
        await this.db.collection("crawler_queue").deleteMany({})
        await this.db.collection("crawler_visited").deleteMany({})
        console.log("Fresh crawl: cleared queue and visited collections.")
      }
      await Promise.all(seedUrls.map(url => this.enqueue(url)))
      while(this.pagesCrawled < this.maxPages && !this.shouldStop){
        while(this.pagesCrawled < this.maxPages && !this.shouldStop){
          const nextUrl = await this.dequeue()
          if(!nextUrl){
            console.log(`Queue empty.`)
            break
          }
          const taskPromise = this.limit(() => this.crawlUrl(nextUrl).catch(err => console.error(err)))
          this.activeTasks.push(taskPromise)
          taskPromise.finally(() => {
            const index = this.activeTasks.indexOf(taskPromise);
            if (index > -1) this.activeTasks.splice(index, 1);
          })
        }
        if(this.activeTasks.length > 0){
          await Promise.all(this.activeTasks)
        }
        else{
          break
        } 
      }
    await Promise.all(this.activeTasks)
    const end = Date.now()
    console.log(`Crawling completed. Total pages crawled ${this.pagesCrawled} (Time taken: ${(end-start)/1000}s).`)
    })()
    return this.crawlPromise
  }
  async isAllowed(url){
    const parsed = new URL(url)
    const domain = `${parsed.protocol}//${parsed.hostname}`
    let robots = this.robotsCache.get(domain)
    if(!robots){
      const robotsTxt = await axios.get(`${domain}/robots.txt`, {
        headers: {
          'User-Agent': this.userAgent
        }["User-Agent"], timeout: 10000
      })
      if(robotsTxt){
        robots = robotsParser(domain, robotsTxt.data)
        this.robotsCache.set(domain, robots)
      }
      else{
        const permissive = robotsParser(`${domain}/robots.txt`, '')
        this.robotsCache.set(domain, permissive)
        return true
      }
    }
    return robots.isAllowed(url, this.userAgent)
  }
}