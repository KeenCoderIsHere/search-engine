import { Level } from "level"
import { LevelDBIndex } from "./indexer/levelDB.js"
import pLimit from "p-limit"
import normalizeUrl from "normalize-url"
import { CheerioWikipediaCrawler } from "./crawler/cheerioWikipedia.js"
import fs from 'fs'
// For autonomously crawling sites using the given seed URLs and their links
export class AutonomousCrawler{
  constructor(options = {}){
    this.statePath = options.statePath || "./crawler-state"
    this.indexPath = options.indexPath || './search-index'
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
    this.fresh = options.fresh || false
    this.crawler = new CheerioWikipediaCrawler({delay: 0})
    if(this.fresh){
      const pathsToDelete = [this.statePath, this.indexPath]
      for(const path of pathsToDelete){
        if(fs.existsSync(path)){
          fs.rmSync(path, {
            recursive: true,
            force: true
          })
          console.log(`Deleted existing database: ${path}`)
        } else {
          console.log(`No existing database at: ${path}`)
        }
      }
    }
    this.stateDB = new Level(this.statePath, {valueEncoding: 'json'})
    this.indexDB = options.indexDB
    if (!this.indexDB) throw new Error('AutonomousCrawler requires an indexDB instance')
  }
  async queueSize(){
    let count = 0
    const iterator = this.stateDB.iterator({
      gte: 'queue:',
      lt: 'queue:' + '\uffff',
      keys: true,
      values: false
    })
    for await(const _ of iterator){
      count++
    }
    return count
  }
  async enforceDelay(domain){
    const now = Date.now()
    const last = this.lastRequest.get(domain) || 0
    const elapsed = now - last
    if(elapsed < this.delay){
      const wait = this.delay - elapsed
      await new Promise(resolve => setTimeout(resolve, wait))
    }
    this.lastRequest.set(domain, Date.now())
  }
  async crawlUrl(url){
    if(this.shouldStop) return
    const domain = new URL(url).hostname
    await this.enforceDelay(domain)
    const cleanedUrl = url.match(/\/wiki\/([^#?]+)/)
    if(!cleanedUrl){
      console.log(`${url} is not a Wikipedia article. Skipping..`)
      await this.markVisited(url, 404)
      return
    }
    const topic = decodeURIComponent(cleanedUrl[1].replace(/_/g,' '))
    const page = await this.crawler.crawlPage(topic)
    if(!page){
      await this.markVisited(url, 404)
      console.log(`${url} not found.`)
      return
    }
    if(this.pagesCrawled >= this.maxPages){
      console.log(`Reached maxPages (${this.maxPages}), skipping indexing.`)
      await this.markVisited(url, 200)
      return
    }
    if(this.shouldStop){
      await this.markVisited(url, 200)
      return
    }
    await this.indexDB.addDocument(page.id, page.content, {
      title: page.title,
      url: page.url,
      crawledAt: Date.now(),
      links: page.links
    })
    this.pagesCrawled++
    console.log(`${this.pagesCrawled}/${this.maxPages} ${page.title}`)
    if(this.pagesCrawled < this.maxPages && !this.shouldStop){
      for(const link of page.links.slice(0,10)){
        const valid = new URL(link, 'https://en.wikipedia.org').href
        await this.enqueue(valid)
      }
    }
    await this.markVisited(url, 200)
  }
  async stop(){
    console.log(`Stopping crawler.`)
    this.shouldStop = true
    if(this.crawlPromise){
      await this.crawlPromise
    }
    if(this.activeTasks.length > 0){
      console.log(`Waiting for ${this.activeTasks.length} active tasks...`)
      await Promise.all(this.activeTasks)
    }
    console.log(`Crawler stopped. Pages crawled ${this.pagesCrawled}`)
  }
  async init(){
    await this.stateDB.open()
    // await this.indexDB.open()
    console.log(`Databases open successfully.`)
  }
  // Clean the given url by removing hashes, www, slashes and query parameters
  normalizeUrl(url){
    return normalizeUrl(url, {
      stripHash: true,
      stripWWW: true,
      removeTrailingSlash: true,
      removeQueryParameters: [/.*/]
    })
  }
  // Add the URL in the queue
  async enqueue(url){
    const normalizedUrl = this.normalizeUrl(url)
    // Create keys for the given URL
    const queueKey = `queue:${normalizedUrl}`
    const visitedKey = `visited:${normalizedUrl}`
    try{
      // Checking if the state database contains the given URL using the visited key
      const results = await this.stateDB.get(visitedKey)
      // If yes, then the given URL has been scraped successfully, so skip it
      if(results !== undefined && results !== null) {
        return
      }
    }
    catch(err){
      if (err.code !== 'LEVEL_NOT_FOUND') {
        console.error(`Error checking visited for ${url}:`, err);
        throw err;
      }
    }
    try{
      // Checking if the state database contains the given URL using the queue key
      const result = await this.stateDB.get(queueKey)
      // If yes, then the given URL is already added in queue and is waiting to be scraped 
      if(result !== undefined && result !== null) {
        return
      }
    }
    catch(err){
      console.log(err)
    }
    // IF both the above conditions fail, then the URL is to be added to the queue
    await this.stateDB.put(queueKey, {
      url: normalizedUrl,
      addedAt: Date.now()
    })
  }
  // TO remove URLs from queue
  async dequeue(){
    const iterator = this.stateDB.iterator({
      gte: 'queue:',
      lt: 'queue:' + '\uffff',
      keys: true,
      values: true,
      limit: 1
    })
    for await(const [key, value] of iterator){
      await this.stateDB.del(key)
      return value.url
    }
    return null
  }
  // Mark visited URLs -> create an entry in the state database with the visited key and also adding a status denoting whether it was successfully crawled or not.
  async markVisited(url, status = 200){
    const normalizedUrl = this.normalizeUrl(url)
    await this.stateDB.put(`visited:${normalizedUrl}`, {
      lastCrawled: Date.now(),
      status: status
    })
  }
  async startSeed(seedUrls) {
    const start = Date.now()
    this.crawlPromise = (async () => {
    // Enqueue all seed URLs into the queue
    for (const url of seedUrls) {
        await this.enqueue(url);
      }
      // shouldStop is used for gracefully shutting down the crawler
      // Outer loop: run until number of pages crawled 
      while(this.pagesCrawled < this.maxPages && !this.shouldStop){
        // Inner loop: same condition
        while(this.pagesCrawled < this.maxPages && !this.shouldStop){
          // Obtain next URL from queue
          const nextUrl = await this.dequeue()
          // If nextURL is empty, break inner loop
          if(!nextUrl){
            console.log(`Queue empty.`)
            break
          }
          // Tracking active tasks and waiting for them to complete
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
  async shutdown(){
    try{
      if(this.stateDB) await this.stateDB.close()
    }
    catch(err){
      console.log(err)
    }
  }
}