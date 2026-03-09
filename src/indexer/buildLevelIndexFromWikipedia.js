import pLimit from "p-limit"
import { CheerioWikipediaCrawler } from "../crawler/cheerioWikipedia.js"
import { LevelDBIndex } from "./levelDB.js"

export async function buildLevelIndexFromWikipedia (seedTopics, maxPages = 50) {
  const limit = pLimit(25)
  const crawler = new CheerioWikipediaCrawler({ delay: 1000 })
  const index = new LevelDBIndex('./scraped-data')
  await index.db.open()
  const topicsToCrawl = seedTopics.slice(0, maxPages)
  const crawlPromises = topicsToCrawl.map((topic) => 
    limit(async () => {
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
    })
  )
  await Promise.all(crawlPromises)
  const count = await index.getDocCount()
  console.log(`Indexed ${count} pages.`)
  return index
} 