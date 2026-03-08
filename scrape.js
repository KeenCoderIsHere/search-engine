import { WikipediaCrawler } from "./src/crawler/wikipedia.js"
import { buildIndexFromWikipedia } from "./src/indexer/buildFromWikipedia.js"
import { buildLevelIndexFromWikipedia } from "./src/indexer/buildLevelIndexFromWikipedia.js"
import { Searcher } from "./src/services/searcher.js"
import { LevelSearcher } from "./src/services/searcherLevel.js"
async function test(){
  const seedTopics = [
  "JavaScript", "Python", "Java", "C++", "C Sharp", "Ruby", "PHP", "Swift", "Kotlin", "TypeScript",
  "Go", "Rust", "Node.js", "React", "Angular", "Vue.js", "Django", "Flask", "TensorFlow", "PyTorch",
  "Docker", "Kubernetes", "Git", "Linux", "Windows", "macOS", "Android", "iOS", "Artificial intelligence", "Machine learning"
]
  console.log(`Building Index...`)
  const startTime = Date.now()
  const index = await buildLevelIndexFromWikipedia(seedTopics)
  console.log(`Index built.`)
  const levelSearcher = new LevelSearcher(index)
  const results = await levelSearcher.search("computer")
  const endTime = Date.now()
  console.log(`Most Relevant Results:`)
  console.log(results)
  console.log(`Time taken: ${(endTime-startTime)/1000}s`)
  const results1 = await levelSearcher.search("computer")
  await index.close()
}

test()
