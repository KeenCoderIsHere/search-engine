import puppeteer from "puppeteer"

export class WikipediaCrawler{
  constructor(options = {}){
    this.delay = options.delay || 1000
    this.userAgent = options.userAgent || 'SearchEngineBot'
    this.browser = null
  }
  async start(){
    this.browser = await puppeteer.launch({
      headless: false
    })
  }
  async stop(){
    if(this.browser){
      await this.browser.close()
    }
  }
  async crawlPage(title){
    if(!this.browser){
      throw new Error('Crawler not started. Call start() first.')
    }
    const page = await this.browser.newPage()
    await page.setUserAgent(this.userAgent)
    const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g,'_'))}`
    try{
      console.log('Navigating to: ',url)
      await page.goto(url)
      const noArticle = await page.$('#noarticletext')
      if(noArticle){
        console.log('Page not found')
        return
      }
      await page.waitForSelector('#mw-content-text', { timeout: 2000 })
      const content = await page.$eval('#mw-content-text', el => el.textContent)
      const pageTitle = await page.$eval('.mw-page-title-main', el => el.textContent.trim())
      const links = await page.$$eval('#mw-content-text a', anchors =>
        anchors
          .map(a => a.getAttribute('href'))
          .filter(href => href && href.startsWith('/wiki/') && !href.includes(':') && !href.includes('#'))
          .map(href => decodeURIComponent(href.replace('/wiki/', '').replace(/_/g, ' ')))
          .slice(0, 10)
      )
      await new Promise(resolve => setTimeout(resolve, this.delay))
      return {
        id: title,
        title: pageTitle,
        content: content,
        url: url,
        links: [...new Set(links)]
      }
    }
    catch(error){
      console.log('Error: ',error)
      return null
    }
    finally{
      await page.close()
    }
  }
}