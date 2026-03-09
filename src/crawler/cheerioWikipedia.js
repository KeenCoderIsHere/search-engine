import axios from "axios"
import * as cheerio from 'cheerio'
import client from "../redisClient.js"

export class CheerioWikipediaCrawler{
  constructor(options = {}){
    this.delay = options.delay || 700
    this.userAgent = options.userAgent || 'SearchEngineBot'
    this.browser = null
  }
  async crawlPage(title){
    const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`
    try{
      const response = await axios.get(url, {
        headers: {
          'User-Agent': this.userAgent,
        },
        timeout: 10000
      })
      const $ = cheerio.load(response.data)
      if($('#noarticletext').length > 0){
        console.log(`Page ${title} does not exist.`)
        return null
      }
      const pageTitle = $('h1#firstHeading').text().trim()
      const content = $('#mw-content-text').text()
      const links = []
      $('#mw-content-text a[href^="/wiki/"]').each((i,el) => {
        if (i >= 10) return false
        const href = $(el).attr('href')
        if(href && !href.includes(':') && !href.includes('#')){
          links.push(href)
        }
      })
      if(this.delay > 0){
        await new Promise(resolve => setTimeout(resolve, this.delay))
      }
      return {
        id: title,
        title: pageTitle,
        content: content,
        url: url,
        links: [...new Set(links)]
      }
    }
    catch(err){
      console.error(err)
      return null
    }
    finally{
      client.flushAll()
    }
  }
}