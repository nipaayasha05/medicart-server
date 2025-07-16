const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 3000;
require("dotenv").config();

const stripe = require("stripe")(process.env.PAYMENT_GATEWAY_KEY);

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
    const paymentCollection = db.collection("payment");
    const paymentCompleteCollection = db.collection("payment-complete");

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

    app.post("/checkout", async (req, res) => {
      const orderData = req.body;
      const result = await paymentCollection.insertOne(orderData);
      res.send(result);
    });

    app.post("/create-payment-intent", async (req, res) => {
      const amountInCents = req.body.amountInCents;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountInCents,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({ clientSecret: paymentIntent.client_secret });
    });

    app.post("/payments-complete", async (req, res) => {
      const checkoutInfo = req.body;
      const result = await paymentCompleteCollection.insertOne(checkoutInfo);
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

    // app.get("/cart-checkout/:id", async (req, res) => {
    //   const { id } = req.params;
    //   const result = await cartCollection
    //     .find({ _id: new ObjectId(id) })
    //     .toArray();
    //   res.send(result);
    // });

    app.get("/checkout/:id", async (req, res) => {
      const { id } = req.params;
      const result = await paymentCollection.findOne({ _id: new ObjectId(id) });

      res.send(result);
    });

    app.get("/invoice/:id", async (req, res) => {
      const { id } = req.params;
      const result = await paymentCompleteCollection.findOne({ _id: id });

      res.send(result);
    });

    app.get("/payment-history", async (req, res) => {
      const email = req.query.email;
      const result = await paymentCompleteCollection.find({ email }).toArray();
      res.send(result);
    });

    app.get("/payment-history-all", async (req, res) => {
      const result = await paymentCompleteCollection.find().toArray();
      res.send(result);
    });

    app.get("/seller-payment-history", async (req, res) => {
      const sellerEmail = req.query.email;
      const allPayments = await paymentCompleteCollection.find().toArray();
      const sellerPayments = [];
      allPayments.forEach((payment) => {
        const sellerItems = payment.items.filter(
          (item) => item.addedBy === sellerEmail
        );
        if (sellerItems.length > 0) {
          sellerItems.forEach((item) => {
            sellerPayments.push({
              _id: payment._id,
              transaction: payment.transaction,
              orderDate: payment.orderDate,
              status: payment.status,
              buyerEmail: payment.email,
              itemName: item.itemName,
              quantity: item.quantity,
              totalPrice: item.totalPrice,
              item: item.itemName,
            });
          });
        }
      });
      res.send(sellerPayments);
    });

    app.get("/all-users", async (req, res) => {
      const filter = {
        email: {
          $ne: req?.user?.email,
        },
      };
      const result = await usersCollection.find(filter).toArray();
      res.send(result);
    });

    app.get("/user", async (req, res) => {
      const email = req.query.email;
      const result = await usersCollection.find({ email }).toArray();
      res.send(result);
    });

    app.get("/seller-sales-revenue", async (req, res) => {
      const sellerEmail = req.query.email;
      const allPayments = await paymentCompleteCollection.find().toArray();

      let paidTotal = 0;
      let pendingTotal = 0;

      allPayments.forEach((payment) => {
        payment.items.forEach((item) => {
          if (item.addedBy === sellerEmail) {
            if (payment.status === "paid") {
              paidTotal += item.totalPrice;
            }
            if (payment.status === "pending") {
              pendingTotal += item.totalPrice;
            }
          }
        });
      });
      res.send({
        paidTotal: parseFloat(paidTotal.toFixed(2)),
        pendingTotal: parseFloat(pendingTotal.toFixed(2)),
      });
    });

    app.get("/admin-sales-revenue", async (req, res) => {
      const allPayments = await paymentCompleteCollection.find().toArray();

      let paidTotal = 0;
      let pendingTotal = 0;

      allPayments.forEach((payment) => {
        const total = parseFloat(payment.grandTotal);
        if (payment.status === "paid") {
          paidTotal += total;
        }
        if (payment.status === "pending") {
          pendingTotal += total;
        }
      });
      res.send({
        paidTotal: parseFloat(paidTotal.toFixed(2)),
        pendingTotal: parseFloat(paidTotal.toFixed(2)),
      });
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

    app.patch("/update-cart/:id", async (req, res) => {
      const { id } = req.params;
      const filter = { _id: new ObjectId(id) };
      const { quantity, totalPrice, price, discount } = req.body;

      const updatedDoc = {
        $set: {
          quantity: Number(quantity),
          totalPrice: Number(totalPrice),
          price: Number(price),
          discount: Number(discount),
        },
      };

      const result = await cartCollection.updateOne(filter, updatedDoc);

      res.send(result);
    });

    // app.patch("/checkbox/:id", async (req, res) => {
    //   const { id } = req.params;
    //   const { selected } = req.body;
    //   const filter = { _id: new ObjectId(id) };
    //   const updatedDoc = { $set: { selected } };
    //   const result = await cartCollection.updateOne(filter, updatedDoc);
    //   res.send(result);
    // });

    app.patch("/update-payment-status/:id", async (req, res) => {
      const { id } = req.params;
      const { status } = req.body;
      const result = await paymentCompleteCollection.updateOne(
        { _id: id },
        { $set: { status: "paid" } }
      );
      res.send(result);
    });

    app.patch("/update-user-role/:id", async (req, res) => {
      const { id } = req.params;
      const { role } = req.body;
      const result = await usersCollection.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: { role },
        }
      );
      res.send(result);
    });

    app.delete("/cart-delete/:id", async (req, res) => {
      const { id } = req.params;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    });

    app.delete("/all-cart-delete", async (req, res) => {
      const { email } = req.query;

      const result = await cartCollection.deleteMany({ userEmail: email });
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
