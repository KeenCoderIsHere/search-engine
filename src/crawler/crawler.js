import axios from "axios"
import * as cheerio from 'cheerio'
import { parseHTML } from "linkedom"
import { Readability } from "@mozilla/readability"
import normalizeUrl from "normalize-url"

export class Crawler{
  constructor(options = {}){
    this.delay = options.delay || 700
    this.userAgent = options.userAgent || 'SearchEngineBot'
  }
  normalizeUrl(url){
      return normalizeUrl(url, {
        stripHash: true,
        stripWWW: true,
        removeTrailingSlash: true,
        removeQueryParameters: [/.*/]
      })
  }
  async crawlPage(url){
    try{
      const response = await axios.get(url, {
        headers: {
          'User-Agent': this.userAgent,
        },
        timeout: 60000
      })
      const contentType = response.headers['content-type']
      if(!contentType || !contentType.includes('text/html')){
        console.log(`Skipping non-HTML content.`)
        return null
      }
      const $ = cheerio.load(response.data)
      if($('#noarticletext').length > 0){
        console.log(`Page ${url} does not exist.`)
        return null
      }
      const { window } = parseHTML(response.data)
      const reader = new Readability(window.document)
      const article = reader.parse()
      const links = []
      $('a[href]').each((i,el) => {
          const href = $(el).attr('href')
          if(!href) return
          try{
            const norm = this.normalizeUrl(new URL(href, url).href)
            if(norm.startsWith('http://') || norm.startsWith('https://')){
              links.push(norm)
            }
          }
          catch(e){}
      })
      if(!article){
        console.log(`Readability failed for ${url}.`)
        $('script, style, nav, header, footer').remove()
        const pageTitle = $('h1#firstHeading').text().trim()
        const content = $('#mw-content-text').text().replace(/\s+/g,' ').trim()
        return {
          id: url,
          title: pageTitle,
          content: content,
          url: url,
          links: [...new Set(links)]
        }
      }
      const pageTitle = article.title
      const content = article.textContent
      return {
        id: url,
        content: content,
        title: pageTitle,
        url: url,
        links: [...new Set(links)]
      }
    }
    catch(err){
      console.error(err.message)
      return null
    }
    finally{
    }
  }
}