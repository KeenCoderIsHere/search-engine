import { Level } from "level"
import { LevelDBIndex } from "./indexer/levelDB.js"
import pLimit from "p-limit"
import normalizeUrl from "normalize-url"
import { CheerioWikipediaCrawler } from "./crawler/cheerioWikipedia.js"
import fs from 'fs'
export class AutonomousCrawler{
  constructor(options = {}){
    this.statePath = options.statePath || "./crawler-state"
    this.indexPath = options.indexPath || './search-index'
    this.concurrency = options.concurrency || 5
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
  for(const _ of iterator){
    count++
  }
  return count
}
  async enforceDelay(domain){
    const now = Date.now()
    const last = this.lastRequest.get(domain) || 0
    const elapsed = now - last
    if(elapsed < this.delay){
      const wait = this.delay = elapsed
      await new Promise(resolve => setTimeout(resolve, wait))
    }
    this.lastRequest.set(domain, Date.now())
  }
  async crawlUrl(url){
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
    await this.indexDB.addDocument(page.id, page.content, {
      title: page.title,
      url: page.url,
      crawledAt: Date.now(),
      links: page.links
    })
    this.pagesCrawled++
    console.log(`${this.pagesCrawled}/${this.maxPages} ${page.title}`)
    for(const link of page.links.slice(0,10)){
      const valid = new URL(link, url).href
      await this.enqueue(valid)
    }
    await this.markVisited(url, 200)
  }
  stop(){
    console.log(`Stopping crawler.`)
    this.shouldStop = true
    return (async () => {
      if (this.crawlPromise) await this.crawlPromise
      await Promise.all(this.activeTasks)
    })()
  }
  async init(){
    await this.stateDB.open()
    await this.indexDB.open()
    console.log(`Databases open successfully.`)
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
    // console.log(`enqueue called with: ${url}`)
    const normalizedUrl = this.normalizeUrl(url)
    // console.log(`   normalized: ${normalizedUrl}`)
    const queueKey = `queue:${normalizedUrl}`
    const visitedKey = `visited:${normalizedUrl}`
    try{
      const results = await this.stateDB.get(visitedKey)
      if(results !== undefined && results !== null) {
        console.log(`   already visited → skipping`, results)
        return
      }
    }
    catch(err){
      if (err.code !== 'LEVEL_NOT_FOUND') {
        console.error(`❌ Error checking visited for ${url}:`, err);
        throw err;
      }
    }
    try{
      const result = await this.stateDB.get(queueKey)
      if(result !== undefined && result !== null) {
        console.log(`   already in queue → skipping`)
        return
      }
    }
    catch(err){
      console.log(err)
    }
    console.log(`   adding to queue: ${normalizedUrl}`);
    await this.stateDB.put(queueKey, {
      url: normalizedUrl,
      addedAt: Date.now()
    })
  }
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
  async markVisited(url, status = 200){
    const normalizedUrl = this.normalizeUrl(url)
    await this.stateDB.put(`visited:${normalizedUrl}`, {
      lastCrawled: Date.now(),
      status: status
    })
  }
  async startSeed(seedUrls) {
  this.crawlPromise = (async () => {
    // Enqueue seeds
    for (const url of seedUrls) {
      await this.enqueue(url);
    }

    // Outer loop: continue until maxPages reached or stopped
    while (this.pagesCrawled < this.maxPages && !this.shouldStop) {
      // Inner loop: dequeue and launch tasks as long as there are URLs
      while (this.pagesCrawled < this.maxPages && !this.shouldStop) {
        const nextUrl = await this.dequeue();
        if (!nextUrl) break; // queue empty for now

        const taskPromise = this.limit(() => this.crawlUrl(nextUrl).catch(err => {
          console.error(`Error in crawlUrl for ${nextUrl}:`, err);
        }));

        this.activeTasks.push(taskPromise);
        taskPromise.finally(() => {
          const index = this.activeTasks.indexOf(taskPromise);
          if (index > -1) this.activeTasks.splice(index, 1);
        });
      }

      // Queue is empty, but tasks may still be running.
      // Wait for at least one task to finish before checking again.
      // We wait for any task to complete (Promise.race) but need to be careful.
      // Instead, we can wait a short time and then check if there are new URLs.
      // A simpler approach: wait for all current tasks to finish, then check queue.
      // This is safe and ensures we don't miss newly enqueued URLs.
      if (this.activeTasks.length > 0) {
        await Promise.all(this.activeTasks);
        // After tasks finish, check queue again – loop will continue if new URLs exist
      } else {
        // No tasks and queue empty: we're done
        break;
      }
    }

    // Final wait for any lingering tasks (should be none)
    await Promise.all(this.activeTasks);
    console.log(`Crawling finished. Total pages: ${this.pagesCrawled}`);
  })();

  return this.crawlPromise;
  }
  async shutdown(){
    try{
      if(this.stateDB) await this.stateDB.close()
      if(this.indexDB) await this.indexDB.close()
    }
    catch(err){
      console.log(err)
    }
  }
}