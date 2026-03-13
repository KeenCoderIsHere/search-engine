import { connectToDatabase } from "./src/db/mongodb.js";
import { processText } from "./src/services/textProcessor.js";

async function make(){
  const db = await connectToDatabase()
  const documents = await db.collection("documents").find().toArray()
  for await(const doc of documents){
    const terms = processText(doc.content)
    const docLength = terms.length
    await db.collection("documents").findOneAndUpdate(
      { _id: doc._id },
      { $set : { docLength: docLength }},
      { upsert: true }
    )
  }
}

async function averageDocumentLength(){
  const db = await connectToDatabase()
  const documents = await db.collection("documents").find()
  let count=0,sum=0,avg=0
  for await(const doc of documents){
    sum += doc.docLength
    count++
  }
  avg = sum/count
  await db.collection("metadata").updateOne(
    { _id: "avgdl" },
    { $set: { value: avg }},
    { upsert: true }
  )
  return avg
}


