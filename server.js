import { QuerySearcher } from "./src/services/searcher.js"
import express from "express"
import cors from 'cors'
import { MongoDBIndex } from "./src/indexer/index.js"
import { AutonomousCrawler } from "./src/autonomousCrawler.js"
import { closeConnection, connectToDatabase } from "./src/db/mongodb.js"
import metafetch from "metafetch"

const app = express()
const PORT = process.env.PORT || 5001
let searcher, index, crawler

async function init(){
  try{
  const seeds = [
// Technology & Programming
'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide',
'https://developer.mozilla.org/en-US/docs/Web/HTML',
'https://developer.mozilla.org/en-US/docs/Web/CSS',
'https://developer.mozilla.org/en-US/docs/Web/API',
'https://nodejs.org/en/docs',
'https://docs.python.org/3/tutorial',
'https://www.geeksforgeeks.org/data-structures',
'https://www.geeksforgeeks.org/fundamentals-of-algorithms',
'https://www.geeksforgeeks.org/computer-network-tutorials',
'https://www.geeksforgeeks.org/operating-systems',
'https://www.freecodecamp.org/news/tag/javascript',
'https://www.freecodecamp.org/news/tag/python',
'https://www.freecodecamp.org/news/tag/algorithms',
'https://www.freecodecamp.org/news/tag/web-development',
'https://css-tricks.com/guides',
'https://web.dev/learn/html',
'https://web.dev/learn/css',
'https://web.dev/learn/javascript',

// Science
'https://www.scientificamerican.com/space',
'https://www.scientificamerican.com/mind-brain',
'https://www.scientificamerican.com/health-medicine',
'https://www.scientificamerican.com/environment',
'https://www.scientificamerican.com/technology',
'https://www.livescience.com/space',
'https://www.livescience.com/animals',
'https://www.livescience.com/health',
'https://www.livescience.com/planet-earth',
'https://www.livescience.com/physics-mathematics',
'https://phys.org/physics-news',
'https://phys.org/space-news',
'https://phys.org/biology-news',
'https://phys.org/technology-news',

// Health & Medicine
'https://www.healthline.com/nutrition',
'https://www.healthline.com/health/mental-health',
'https://www.healthline.com/health/fitness',
'https://www.medicalnewstoday.com/categories/nutrition',
'https://www.medicalnewstoday.com/categories/mental-health',
'https://www.medicalnewstoday.com/categories/cardiovascular',
'https://www.webmd.com/diet/default.htm',
'https://www.webmd.com/fitness-exercise/default.htm',
'https://www.webmd.com/mental-health/default.htm',

// History
'https://www.history.com/topics/ancient-history',
'https://www.history.com/topics/world-war-ii',
'https://www.history.com/topics/cold-war',
'https://www.history.com/topics/american-history',
'https://www.history.com/topics/inventions',
'https://www.ancient.eu/article',
'https://www.britannica.com/topic/history-of-Europe',
'https://www.britannica.com/topic/history-of-Asia',
'https://www.britannica.com/topic/history-of-Africa',

// Philosophy & Psychology
'https://plato.stanford.edu/contents.html',
'https://www.verywellmind.com/psychology-theories-4157184',
'https://www.verywellmind.com/cognitive-psychology-4157181',
'https://www.verywellmind.com/social-psychology-4157219',
'https://www.psychologytoday.com/us/basics/cognitive-behavioral-therapy',
'https://www.psychologytoday.com/us/basics/emotional-intelligence',
'https://www.psychologytoday.com/us/basics/motivation',

// Space & Astronomy
'https://www.nasa.gov/solar-system',
'https://www.nasa.gov/humans-in-space',
'https://www.nasa.gov/universe',
'https://www.nasa.gov/earth',
'https://www.space.com/milky-way',
'https://www.space.com/black-holes',
'https://www.space.com/mars',
'https://www.space.com/the-universe',

// Environment & Nature
'https://www.nationalgeographic.com/environment/article/climate-change-overview',
'https://www.nationalgeographic.com/animals',
'https://www.nationalgeographic.com/environment',
'https://www.nationalgeographic.com/science',
'https://www.bbc.com/future/earth',
'https://www.bbc.com/future/science',

// Economics & Finance
'https://www.investopedia.com/economics-4689800',
'https://www.investopedia.com/financial-term-dictionary-4769738',
'https://www.investopedia.com/investing-4427685',
'https://www.investopedia.com/cryptocurrency-4427699',
'https://hbr.org/topic/economics',
'https://hbr.org/topic/technology',
'https://hbr.org/topic/leadership',

// General Knowledge & Reference
'https://www.britannica.com/science/mathematics',
'https://www.britannica.com/science/physics',
'https://www.britannica.com/science/chemistry',
'https://www.britannica.com/science/biology',
'https://www.britannica.com/technology/computer',
'https://www.britannica.com/art/literature',
'https://www.britannica.com/topic/philosophy',
'https://www.britannica.com/topic/religion',

// Culture & Society
'https://www.bbc.com/culture/art',
'https://www.bbc.com/culture/music',
'https://www.bbc.com/culture/film',
'https://www.smithsonianmag.com/history',
'https://www.smithsonianmag.com/science-nature',
'https://www.smithsonianmag.com/innovation',
'https://www.smithsonianmag.com/arts-culture',

// AI & Future
'https://www.technologyreview.com/topic/artificial-intelligence',
'https://www.technologyreview.com/topic/computing',
'https://www.technologyreview.com/topic/biotechnology',
'https://www.technologyreview.com/topic/climate-change',
'https://www.technologyreview.com/topic/space',
  ]
  console.log("Step 1")

  const db = await connectToDatabase()
  console.log("Step 2")

  index = new MongoDBIndex(db)
  console.log("Step 3")

  await index.ensureIndexes()
  console.log("Step 4")

  searcher = new QuerySearcher(index)
  console.log("Step 5")

  crawler = new AutonomousCrawler({
    db: db, 
    index: index, 
    maxPages: 200, 
    concurrency: 30, 
    delay: 200, 
    fresh: true
  })
  console.log("Step 6")

  crawler.startSeed(seeds).catch(console.error)

  console.log("Step 7")
  }
  catch(err){
    console.error(err.message)
    process.exit(1)
  }
}
await init()
app.use(cors())
app.use(express.json())
app.get('/', (req, res) => {
  res.json({message: 'Search Engine running successfully!'})
})
app.get('/metadata', async (req, res) => {
  const { url } = req.query
  if(!url){
    return res.status(400).json({
      error: 'URL Parameter is required!'
    })
  }
  try{
    metafetch.fetch(url, (err, meta) => {
      if(err){
        console.log(`Error fetching metadata for ${url}.`)
        return res.status(500).json({
          error: 'Error fetching metadata!'
        })
      }
      res.status(200).json({
        image: meta.image || null,
        description: meta.description || null
      })
    })
  }
  catch(error){
    console.log(err.message)
    res.status(500).json({
      error: err.message
      })
  }
})
app.get('/search', async (req, res) => {
  const q = req.query.q
  const offset = parseInt(req.query.offset) || 0
  const limit = parseInt(req.query.limit) || 20

  if(!q || q.trim() === ''){
    return res.status(400).json({
      message: 'Missing parameter "q" (query)!'
    })
  }
  try{
    const {results, total} = await searcher.search(q,offset,limit)
    return res.json({
      query: q,
      count: total,
      results
    })
  }
  catch(err){
    console.error(err.message)
    res.status(500).json({
      message: "Internal server error"
    })
  }
})

let shuttingDown = false
async function shutdown() {
  if (shuttingDown) return
  shuttingDown = true
  console.log('Shutting down gracefully...')

  try {
    if(crawler){
      await crawler.stop()
    }
    await closeRedisClient()
    await closeConnection()
    if (client && client.isOpen) {
      await client.quit()
      console.log('Redis client closed.')
    }
  } catch (err) {
    console.error('Error during shutdown:', err.message)
  } finally {
    process.exit(0)
  }
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
app.listen(PORT, () => {
  console.log(`Server listening to port ${PORT}.`)
})
