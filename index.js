const express = require("express");
const cors = require("cors");
const app = express();
const port = 4000;

require("dotenv").config();

app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

app.get("/", (req, res) => {
  res.send("Nexa server!");
});

const uri = process.env.MONGODB_URL;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const database = client.db("housify");
    const propertiesCollection = database.collection("all_properties");
    const bookingDetailsCollection = database.collection("booking_details")

    app.get("/api/all-properties", async (req, res) => {
      const result = await propertiesCollection.find().toArray();
      res.send(result);
    });

    app.get("/api/properties", async (req, res) => {
      const { userId } = req.query;

      const result = await propertiesCollection
        .find({ userId: userId })
        .toArray();
      res.send(result);
    });


    // app.get('/api/property/:id', async(req, res) => {
    //   const id = req.params;

    //   const result = await propertiesCollection.findOne(id);
    //   res.send(result);
    // })


    app.get("/api/property/:id", async (req, res) => {
      try {
        const { id } = req.params;

        const result = await propertiesCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!result) {
          return res.status(404).json({ message: "Property not found" });
        }

        res.json(result);
      } catch (error) {
        res.status(500).json({ message: "Server error", error });
      }
    });


    app.post("/api/property", async (req, res) => {
      const property = req.body;
      const result = await propertiesCollection.insertOne(property);
      res.send(result);
    });


    app.post("/api/bookings/create", async (req, res) => {
      const bookingDetails = req.body;
      const result = await bookingDetailsCollection.insertOne(bookingDetails);
      res.send(result);
    });


    

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
