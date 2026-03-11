import client from "./src/redisClient.js"
import { LevelSearcher } from "./src/services/searcherLevel.js"
import express from "express"
import cors from 'cors'
import { LevelDBIndex } from "./src/indexer/levelDB.js"
import { AutonomousCrawler } from "./src/autonomousCrawler.js"
const app = express()
const PORT = process.env.PORT || 5001
let levelSearcher, index, crawler
async function init(){
  try{
    // Create a common database (LevelDB) instance for both crawler and searcher
    index = new LevelDBIndex('./scraped-data')
    await index.db.open()
    console.log(`Index Database Opened.`)
    // Create a new instance of the Level Searcher and pass the index database instance
    levelSearcher = new LevelSearcher(index)
    // Create a new instance of the autonomous crawler
    crawler = new AutonomousCrawler({
      statePath: './crawler-state',
      indexDB: index,
      maxPages: 200,
      concurrency: 20,
      delay: 200,
      fresh: false
    })
    // Initial seed URLs for the crawler
    const seeds = [
  'https://en.wikipedia.org/wiki/JavaScript',
  'https://en.wikipedia.org/wiki/Python_(programming_language)',
  'https://en.wikipedia.org/wiki/Java_(programming_language)',
  'https://en.wikipedia.org/wiki/C_(programming_language)',
  'https://en.wikipedia.org/wiki/C%2B%2B',
  'https://en.wikipedia.org/wiki/C_Sharp_(programming_language)',
  'https://en.wikipedia.org/wiki/Ruby_(programming_language)',
  'https://en.wikipedia.org/wiki/PHP',
  'https://en.wikipedia.org/wiki/Swift_(programming_language)',
  'https://en.wikipedia.org/wiki/Kotlin_(programming_language)',
  'https://en.wikipedia.org/wiki/Go_(programming_language)',
  'https://en.wikipedia.org/wiki/Rust_(programming_language)',
  'https://en.wikipedia.org/wiki/TypeScript',
  'https://en.wikipedia.org/wiki/SQL',
  'https://en.wikipedia.org/wiki/HTML',
  'https://en.wikipedia.org/wiki/CSS',
  'https://en.wikipedia.org/wiki/Node.js',
  'https://en.wikipedia.org/wiki/React_(JavaScript_library)',
  'https://en.wikipedia.org/wiki/Angular_(web_framework)',
  'https://en.wikipedia.org/wiki/Vue.js',
  'https://en.wikipedia.org/wiki/Django_(web_framework)',
  'https://en.wikipedia.org/wiki/Flask_(web_framework)',
  'https://en.wikipedia.org/wiki/TensorFlow',
  'https://en.wikipedia.org/wiki/PyTorch',
  'https://en.wikipedia.org/wiki/Docker_(software)',
  'https://en.wikipedia.org/wiki/Kubernetes',
  'https://en.wikipedia.org/wiki/Git',
  'https://en.wikipedia.org/wiki/Linux',
  'https://en.wikipedia.org/wiki/Microsoft_Windows',
  'https://en.wikipedia.org/wiki/MacOS',
  'https://en.wikipedia.org/wiki/Android_(operating_system)',
  'https://en.wikipedia.org/wiki/IOS',
  'https://en.wikipedia.org/wiki/Artificial_intelligence',
  'https://en.wikipedia.org/wiki/Machine_learning',
  'https://en.wikipedia.org/wiki/Deep_learning',
  'https://en.wikipedia.org/wiki/Computer_science',
  'https://en.wikipedia.org/wiki/Algorithm',
  'https://en.wikipedia.org/wiki/Data_structure',
  'https://en.wikipedia.org/wiki/World_Wide_Web',
  'https://en.wikipedia.org/wiki/Internet',
  'https://en.wikipedia.org/wiki/Web_browser',
  'https://en.wikipedia.org/wiki/Web_server',
  'https://en.wikipedia.org/wiki/HTTP',
  'https://en.wikipedia.org/wiki/HTTPS',
  'https://en.wikipedia.org/wiki/Domain_Name_System',
  'https://en.wikipedia.org/wiki/IP_address',
  'https://en.wikipedia.org/wiki/Cloud_computing',
  'https://en.wikipedia.org/wiki/Virtualization',
  'https://en.wikipedia.org/wiki/Database',
  'https://en.wikipedia.org/wiki/NoSQL'
    ]
    // Start the crawler with the seed URLs
    crawler.startSeed(seeds).catch(console.error)
  }
  catch(err){
    console.error(err)
    process.exit(1)
  }
}
await init()
// Cross-Origin Resource Sharing 
app.use(cors())
app.use(express.json())
app.get('/', (req, res) => {
  res.json({message: 'Search Engine running successfully!'})
})
app.get('/search', async (req, res) => {
  const {q} = req.query
  if(!q || q.trim() === ''){
    return res.status(400).json({
      message: 'Missing parameter "q" (query)!'
    })
  }
  try{
    // Search with the given query
    const results = await levelSearcher.search(q)
    return res.json({
      query: q,
      count: results.length,
      results
    })
  }
  catch(err){
    console.error(err)
    res.status(500).json({
      message: "Internal server error"
    })
  }
})
// Set shutting down to false initially
let shuttingDown = false
// Function for gracefully shutting down the search engine 
async function shutdown() {
  if (shuttingDown) return
  shuttingDown = true
  console.log('Shutting down gracefully...')

  try {
    // Stop the crawler
    if(crawler){
      await crawler.stop()
      await crawler.shutdown()
    }
    // Close the index database (LevelDB)
    if (index) await index.close()
    // Close Redis client 
    if (client && client.isOpen) {
      await client.quit()
      console.log('Redis client closed.')
    }
  } catch (err) {
    console.error('Error during shutdown:', err)
  } finally {
    process.exit(0)
  }
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
app.listen(PORT, () => {
  console.log(`Server listening to port ${PORT}.`)
})
