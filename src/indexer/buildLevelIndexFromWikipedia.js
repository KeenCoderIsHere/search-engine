import pLimit from "p-limit"
import { CheerioWikipediaCrawler } from "../crawler/cheerioWikipedia.js"
import { LevelDBIndex } from "./levelDB.js"
// Building the index database by crawling the given seed URLs
export async function buildLevelIndexFromWikipedia (seedTopics, maxPages = 50) {
  // For concurrency
  const limit = pLimit(25)
  // Create crawler instance
  const crawler = new CheerioWikipediaCrawler({ delay: 1000 })
  // Create the database for storing the scraped data (what the crawler returns)
  const index = new LevelDBIndex('./scraped-data')
  // Open the database
  await index.db.open()
  const topicsToCrawl = seedTopics.slice(0, maxPages)
  // Async function which does crawling and extracting content for each topic
  const crawlAndExtractContent = async (topic) => {
        try{
          const page = await crawler.crawlPage(topic)
          if(page){
            await index.addDocument(page.id, page.content, {
              title: page.title,
              url: page.url,
              crawledAt: Date.now(),
              links: page.links
            })
          }
          else{
            console.log(`Page not found: ${topic}`)
          }
        }
        catch(err){
          console.error(err)
        }
    }
  // we wrap the crawlAndExtractContent function inside limit which runs the wrapper function simultaneously 5 (eg) times for each topic
  // Returns a promise for each topic
  const crawlPromises = topicsToCrawl.map((topic) => limit(crawlAndExtractContent(topic)))
  // Wait until all promises are resolved
  await Promise.all(crawlPromises)
  // See how many pages have we successfully crawled and indexed
  const count = await index.getDocCount()
  console.log(`Indexed ${count} pages.`)
  return index
} 