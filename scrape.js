// import { WikipediaCrawler } from "./src/crawler/wikipedia.js"
// async function test(){
//   const crawler = new WikipediaCrawler({
//     delay: 2000
//   })
//   await crawler.start()
//   const topics = ["Car","Node.js","Susheeth Venkatraman"]
//   for(const topic of topics){
//     console.log(`Crawling ${topic}...`)
//     const result = await crawler.crawlPage(topic)
//     if(result){
//       console.log(`Title: ${result.title}`)
//     }
//     console.log('Crawling done!')
//   }
//   await crawler.stop()
// }

// test()

import { processText } from "./src/services/textProcessor.js"

console.log(processText("I didn't even know what to tell at that moment."))