import { WikipediaCrawler } from "./src/crawler/wikipedia.js"
import { buildIndexFromWikipedia } from "./src/indexer/buildFromWikipedia.js"
import { buildLevelIndexFromWikipedia } from "./src/indexer/buildLevelIndexFromWikipedia.js"
import { Searcher } from "./src/services/searcher.js"
import { LevelSearcher } from "./src/services/searcherLevel.js"
async function test(){
  const seedTopics = [
  // Programming & Technology
  "JavaScript", "Python", "Java", "C++", "C Sharp", "Ruby", "PHP", "Swift", "Kotlin", "TypeScript",
  "Go", "Rust", "Node.js", "React", "Angular", "Vue.js", "Django", "Flask", "TensorFlow", "PyTorch",
  "Docker", "Kubernetes", "Git", "Linux", "Windows", "macOS", "Android", "iOS", "Artificial intelligence", "Machine learning",
  "Blockchain", "Cryptocurrency", "Bitcoin", "Ethereum", "Internet", "World Wide Web", "HTML", "CSS", "SQL", "NoSQL",
];
  console.log(`Building Index...`)
  const index = await buildLevelIndexFromWikipedia(seedTopics)
  console.log(`Index built.`)
  const levelSearcher = new LevelSearcher(index)
  const results = await levelSearcher.search("nvidia")
  console.log(`Search Results:`)
  console.log(results)
  await index.close()
}

test()
