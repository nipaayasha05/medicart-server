const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 3000;
require("dotenv").config();

// DsiyMUjOCfTiWmLY
//medicine-selling

app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.sgjw94w.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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
    // await client.connect();
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });

    const db = client.db("medicinedb");
    const usersCollection = db.collection("users");
    const medicinesCollection = db.collection("medicine");
    const medicinesAdvertisement = db.collection("advertisement");
    const cartCollection = db.collection("cart");

    app.post("/user", async (req, res) => {
      const userData = req.body;
      userData.created_at = new Date().toISOString();
      userData.last_loggedIn = new Date().toISOString();
      const result = await usersCollection.insertOne(userData);
      res.send(result);
    });

    app.post("/addMedicine", async (req, res) => {
      const addMedicine = req.body;
      const result = await medicinesCollection.insertOne(addMedicine);
      res.send(result);
    });

    app.post("/addAdvertisement", async (req, res) => {
      const addAdvertisement = req.body;
      const result = await medicinesAdvertisement.insertOne(addAdvertisement);
      res.send(result);
    });

    app.post("/add-to-cart", async (req, res) => {
      const cartItem = req.body;
      const result = await cartCollection.insertOne(cartItem);
      res.send(result);
    });

    app.get("/getMedicine", async (req, res) => {
      const email = req.query.email;
      const result = await medicinesCollection.find({ email }).toArray();
      res.send(result);
    });
    app.get("/getAllMedicine", async (req, res) => {
      const result = await medicinesCollection.find().toArray();
      res.send(result);
    });

    app.get("/getAdvertisement", async (req, res) => {
      const email = req.query.email;
      const result = await medicinesAdvertisement.find({ email }).toArray();
      res.send(result);
    });

    app.get("/getAdminAdvertise", async (req, res) => {
      const result = await medicinesAdvertisement.find().toArray();
      res.send(result);
    });

    app.get("/get-add-to-cart", async (req, res) => {
      const email = req.query.email;
      const result = await cartCollection.find({ userEmail: email }).toArray();
      res.send(result);
    });

    app.patch("/advertise-status/:id", async (req, res) => {
      const { id } = req.params;
      const { status } = req.body;
      const result = await medicinesAdvertisement.updateOne(
        {
          _id: new ObjectId(id),
        },
        { $set: { status } }
      );
      res.send(result);
    });

    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("medicine server");
});

app.listen(port, () => {
  console.log(`medicine server is running on port ${port}`);
});
