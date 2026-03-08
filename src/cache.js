class SearchCache{
  constructor(ttl = 300){
    this.cache = new Map()
    this.ttl = ttl*1000
  }
  set(key, value){
    const expires = Date.now()+this.ttl
    this.cache.set(key, {
      value,
      expires
    })
  }
  get(key){
    const item = this.cache.get(key)
    if(!item) return null
    if(Date.now() > item.expires){
      this.cache.delete(key)
      return null
    }
    return item.value
  }
  clear(){
    this.cache.clear()
  }
}

export default new SearchCache()