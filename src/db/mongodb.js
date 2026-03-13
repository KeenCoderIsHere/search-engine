import { MongoClient } from "mongodb"
import dotenv from 'dotenv'
dotenv.config()

const client = new MongoClient(process.env.MONGODB_URI)
let db = null

export async function connectToDatabase(){
  try{
    if(db) return db
    await client.connect()
    console.log(`Connected to MongoDB.`)
    db = client.db(process.env.DB_NAME)
    return db
  }
  catch(err){
    console.error(err)
    throw err
  }
}

export async function closeConnection(){
  try{
    if(client){
      await client.close()
      console.log(`MongoDB connection closed.`)
    }
  }
  catch(err){
    console.error(err)
    throw err
  }
}
