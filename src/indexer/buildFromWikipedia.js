import { WikipediaCrawler } from "../crawler/wikipedia.js"
import { InvertedIndex } from "./invertedIndex.js"

export async function buildIndexFromWikipedia (seedTopics, maxPages = 50) {
  const crawler = new WikipediaCrawler({ delay: 1000 })
  const invertedIndex = new InvertedIndex()
  await crawler.start()
  let pagesCrawled = 0
  const visited = new Set()
  for(const topic of seedTopics){
    try{
      if(visited.has(topic)) continue
      if(pagesCrawled >= maxPages) break
      const page = await crawler.crawlPage(topic)
      if(page){
        pagesCrawled++
        await collection.updateOne(
          { _id: page.id },
          {
            $set: {
              title: page.title,
              url: page.url,
              content: page.content,
              crawledAt: new Date(),
              links: page.links
            }
          },
          { upsert: true }
        )
      }
    }
    catch(error){
      console.log(`Error: ${error.message}`)
    }
    finally{
      
    }
  }
  await crawler.stop()
  console.log(`Indexed ${count} pages.`)
  return count
}