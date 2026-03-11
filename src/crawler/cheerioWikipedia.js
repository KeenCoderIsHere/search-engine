import axios from "axios"
import * as cheerio from 'cheerio'
import client from "../redisClient.js"
// Crawler for scraping the content from websites
export class CheerioWikipediaCrawler{
  constructor(options = {}){
    // Delay to avoid overwhelming the server
    this.delay = options.delay || 700
    this.userAgent = options.userAgent || 'SearchEngineBot'
  }
  async crawlPage(title){
    // Scraping from wikipedia documents
    const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`
    try{
      // Get the full content by making a request using GET
      const response = await axios.get(url, {
        headers: {
          'User-Agent': this.userAgent,
        },
        timeout: 60000
      })
      // Cheerio makes it possible to select elements from the retrieved content
      const $ = cheerio.load(response.data)
      // If no page is fetched
      if($('#noarticletext').length > 0){
        console.log(`Page ${title} does not exist.`)
        return null
      }
      // Title
      const pageTitle = $('h1#firstHeading').text().trim()
      // Content
      const content = $('#mw-content-text').text()
      const links = []
      // Links in the main content
      $('#mw-content-text a[href^="/wiki/"]').each((i,el) => {
        if (i >= 20) return false
        const href = $(el).attr('href')
        if(href && !href.includes(':') && !href.includes('#')){
          links.push(href)
        }
      })
      // Return the page: title, content, URL, links
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
      // Delete all keys and values cached in the redis database
    }
  }
}