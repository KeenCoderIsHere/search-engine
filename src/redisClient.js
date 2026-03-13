import { createClient } from "redis"

import dotenv from "dotenv"

dotenv.config()

const redisUrl = "redis://localhost:6379"
const client = createClient({ url: redisUrl })

client.on('error', (err) => console.error(err.message))
client.on('connect', () => console.log('Redis connected'))

await client.connect()

export default client