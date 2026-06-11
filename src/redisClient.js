import { createClient } from "redis"

import dotenv from "dotenv"

dotenv.config()

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379"
const useTLS = redisUrl.startsWith('rediss://')
let client = null

export async function getRedisClient(){
    if(client && client.isOpen) return client
    client = createClient({
        url: redisUrl,
        socket: {
            tls: useTLS,
            reconnectStrategy: (retries) => {
                if(retries > 5){
                    console.error('Redis connection failed after 5 retries. Giving up.')
                    return new Error('Redis connection failed')
                }
                return 1000
            }
        }
    })
    client.on('error', (err) => console.error(err.message))
    client.on('connect', () => console.log('Redis connected'))
    await client.connect()
    return client
}

export async function closeRedisClient() {
  if (client && client.isOpen) {
    await client.quit()
    console.log('Redis client closed.')
  }
}