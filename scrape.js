import { WikipediaCrawler } from "./src/crawler/wikipedia.js"
import { buildIndexFromWikipedia } from "./src/indexer/buildFromWikipedia.js"
import { Searcher } from "./src/services/searcher.js"
async function test(){
  const seedTopics = ['Car','Node.js', 'JavaScript', 'Susheeth Venkatraman']
  console.log(`Building Index...`)
  const index = await buildIndexFromWikipedia(seedTopics)
  console.log(`Index built.`)
  const searcher = new Searcher(index)
  const results = searcher.search("Ford")
  console.log(`Search Results:`)
  console.log(results)
}

test()
