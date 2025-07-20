const express = require("express");
const cors = require("cors");
const app = express();
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const port = process.env.PORT || 3000;
require("dotenv").config();

const stripe = require("stripe")(process.env.PAYMENT_GATEWAY_KEY);

// DsiyMUjOCfTiWmLY
//medicine-selling

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://illustrious-pudding-bb0b01.netlify.app",
    ],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

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

const verifyToken = (req, res, next) => {
  const token = req?.cookies?.token;
  // console.log(token);
  if (!token) return res.status(401).send({ message: "Unauthorized Access" });
  jwt.verify(token, process.env.JWT_SECRET_KEY, (err, decoded) => {
    if (err) {
      // console.log(err);
      return res.status(401).send({ message: "Unauthorized Access" });
    }
    req.user = decoded;
    next();
  });
  // console.log(token);
};

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
    const categoryCollection = db.collection("category");

    const verifyAdmin = async (req, res, next) => {
      const email = req?.user?.email;
      const user = await usersCollection.findOne({ email });
      if (!user || user?.role !== "Admin")
        return res.status(403).send({ message: "Admin only " });
      next();
    };

    const verifySeller = async (req, res, next) => {
      const email = req?.user?.email;
      const user = await usersCollection.findOne({ email });
      if (!user || user?.role !== "Seller")
        return res.status(403).send({ message: "Seller only" });
      next();
    };

    app.post("/jwt", (req, res) => {
      const email = req.body;
      const token = jwt.sign(email, process.env.JWT_SECRET_KEY, {
        expiresIn: "7d",
      });

      res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });

    app.get("/logout", async (req, res) => {
      res
        .clearCookie("token", {
          maxAge: 0,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });

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

    app.post("/manageCategory", async (req, res) => {
      const category = req.body;
      const result = await categoryCollection.insertOne(category);
      res.send(result);
    });

    app.get("/getMedicine", verifyToken, verifySeller, async (req, res) => {
      const email = req.query.email;
      const search = req.query.search;
      const sort = req.query.sort;
      let query = {};

      if (search) {
        const isNumber = !isNaN(search);

        if (isNumber) {
          query = {
            $or: [
              {
                itemName: { $regex: search, $options: "i" },
              },
              {
                genericName: { $regex: search, $options: "i" },
              },
              {
                category: { $regex: search, $options: "i" },
              },
              {
                company: { $regex: search, $options: "i" },
              },
              {
                price: parseFloat(search),
              },
              {
                discount: parseFloat(search),
              },
            ],
          };
        } else {
          query = {
            $or: [
              {
                itemName: { $regex: search, $options: "i" },
              },
              {
                genericName: { $regex: search, $options: "i" },
              },
              {
                category: { $regex: search, $options: "i" },
              },
              {
                company: { $regex: search, $options: "i" },
              },
            ],
          };
        }
      }

      let sortOperation = { createdAt: -1 };

      if (email) {
        query.email = email;
      }

      if (sort === "Low to High") {
        sortOperation = { price: 1 };
      } else if (sort === "High to Low") {
        sortOperation = { price: -1 };
      }

      const result = await medicinesCollection
        .find(query)
        .sort(sortOperation)
        .toArray();
      res.send(result);
    });

    app.get("/getAllMedicine", async (req, res) => {
      const search = req.query.search;
      const sort = req.query.sort;
      let query = {};

      if (search) {
        const isNumber = !isNaN(search);

        if (isNumber) {
          query = {
            $or: [
              {
                itemName: { $regex: search, $options: "i" },
              },

              {
                category: { $regex: search, $options: "i" },
              },
              {
                company: { $regex: search, $options: "i" },
              },
              {
                price: parseFloat(search),
              },
              {
                discount: parseFloat(search),
              },
            ],
          };
        } else {
          query = {
            $or: [
              {
                itemName: { $regex: search, $options: "i" },
              },

              {
                category: { $regex: search, $options: "i" },
              },
              {
                company: { $regex: search, $options: "i" },
              },
            ],
          };
        }
      }
      let sortOperation = { createdAt: -1 };

      if (sort === "Low to High") {
        sortOperation = { price: 1 };
      } else if (sort === "High to Low") {
        sortOperation = { price: -1 };
      }

      const result = await medicinesCollection
        .find(query)
        .sort(sortOperation)
        .toArray();
      res.send(result);
    });

    app.get(
      "/getAdvertisement",
      verifyToken,
      verifySeller,
      async (req, res) => {
        const email = req.query.email;
        const result = await medicinesAdvertisement
          .find({ email })
          .sort({ createdAt: -1 })
          .toArray();
        res.send(result);
      }
    );

    app.get(
      "/getAdminAdvertise",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const result = await medicinesAdvertisement
          .find()
          .sort({ createdAt: -1 })
          .toArray();
        res.send(result);
      }
    );

    app.get("/getHomeAdvertise", async (req, res) => {
      const result = await medicinesAdvertisement
        .find()
        .sort({ createdAt: -1 })
        .toArray();
      res.send(result);
    });

    app.get("/get-add-to-cart", verifyToken, async (req, res) => {
      const email = req.query.email;
      const search = req.query.search;
      const sort = req.query.sort;
      let query = {};

      if (search) {
        const isNumber = !isNaN(search);

        if (isNumber) {
          query = {
            $or: [
              {
                itemName: { $regex: search, $options: "i" },
              },

              {
                category: { $regex: search, $options: "i" },
              },
              {
                company: { $regex: search, $options: "i" },
              },
              {
                price: parseFloat(search),
              },
              {
                discount: parseFloat(search),
              },
            ],
          };
        } else {
          query = {
            $or: [
              {
                itemName: { $regex: search, $options: "i" },
              },

              {
                category: { $regex: search, $options: "i" },
              },
              {
                company: { $regex: search, $options: "i" },
              },
            ],
          };
        }
      }

      let sortOperation = { addedAt: -1 };

      if (email) {
        query.userEmail = email;
      }

      if (sort === "Low to High") {
        sortOperation = { price: 1 };
      } else if (sort === "High to Low") {
        sortOperation = { price: -1 };
      }
      const result = await cartCollection
        .find(query)
        .sort(sortOperation)
        .toArray();
      res.send(result);
    });

    app.get("/get-add-to-cart-shop", async (req, res) => {
      const email = req.query.email;
      const result = await cartCollection
        .find({ userEmail: email })
        .sort({ addedAt: -1 })
        .toArray();
      res.send(result);
    });

    app.get("/checkout/:id", verifyToken, async (req, res) => {
      const { id } = req.params;
      const result = await paymentCollection.findOne({ _id: new ObjectId(id) });

      res.send(result);
    });

    app.get("/invoice/:id", verifyToken, async (req, res) => {
      const { id } = req.params;
      const result = await paymentCompleteCollection.findOne({ _id: id });

      res.send(result);
    });

    app.get("/payment-history", verifyToken, async (req, res) => {
      const email = req.query.email;
      const search = req.query.search;
      const sort = req.query.sort;

      let query = {};

      if (search) {
        const isNumber = !isNaN(search);
        if (isNumber) {
          query = {
            $or: [
              { transaction: { $regex: search, $options: "i" } },
              { status: { $regex: search, $options: "i" } },
              { grandTotal: parseFloat(search) },
            ],
          };
        } else {
          query = {
            $or: [
              { transaction: { $regex: search, $options: "i" } },
              { status: { $regex: search, $options: "i" } },
            ],
          };
        }
      }

      let sortOperation = { orderDate: -1 };

      if (email) {
        query.email = email;
      }

      if (sort === "Low to High") {
        sortOperation = { grandTotal: 1 };
      } else if (sort === "High to Low") {
        sortOperation = { grandTotal: -1 };
      }

      const result = await paymentCompleteCollection
        .find(query)
        .sort(sortOperation)
        .toArray();
      res.send(result);
    });

    app.get(
      "/payment-history-all",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const search = req.query.search;
        const sort = req.query.sort;

        let query = {};

        if (search) {
          const isNumber = !isNaN(search);
          if (isNumber) {
            query = {
              $or: [
                { transaction: { $regex: search, $options: "i" } },
                { status: { $regex: search, $options: "i" } },
                { grandTotal: parseFloat(search) },
              ],
            };
          } else {
            query = {
              $or: [
                { transaction: { $regex: search, $options: "i" } },
                { status: { $regex: search, $options: "i" } },
              ],
            };
          }
        }

        let sortOperation = { orderDate: -1 };

        if (sort === "Low to High") {
          sortOperation = { grandTotal: 1 };
        } else if (sort === "High to Low") {
          sortOperation = { grandTotal: -1 };
        }

        const result = await paymentCompleteCollection
          .find(query)
          .sort(sortOperation)
          .toArray();
        res.send(result);
      }
    );

    app.get(
      "/seller-payment-history",
      verifyToken,
      verifySeller,
      async (req, res) => {
        const sellerEmail = req.query.email;
        const search = req.query.search;
        const sort = req.query.sort;

        let query = {};

        const allPayments = await paymentCompleteCollection
          .find()
          .sort({ orderDate: -1 })
          .toArray();
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

        let filterPayments = sellerPayments;
        if (search) {
          const lowerSearch = search.toLowerCase();
          filterPayments = filterPayments.filter(
            (payment) =>
              payment.itemName.toLowerCase().includes(lowerSearch) ||
              payment.buyerEmail.toLowerCase().includes(lowerSearch) ||
              payment.transaction.toLowerCase().includes(lowerSearch) ||
              payment.quantity.toString().includes(lowerSearch) ||
              payment.totalPrice.toString().includes(lowerSearch)
          );
        }

        if (sort === "Low to High") {
          filterPayments.sort((a, b) => a.totalPrice - b.totalPrice);
        } else if (sort === "High to Low") {
          filterPayments.sort((a, b) => b.totalPrice - a.totalPrice);
        } else {
          filterPayments.sort(
            (a, b) => new Date(b.orderDate) - new Date(a.orderDate)
          );
        }

        res.send(filterPayments);
      }
    );

    app.get(
      "/admin-sales-report",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const search = req.query.search;
        const sort = req.query.sort;

        const payments = await paymentCompleteCollection
          .find()
          .sort({ orderDate: -1 })
          .toArray();
        const result = [];
        payments.forEach((payment) => {
          payment.items.forEach((item) => {
            result.push({
              medicineName: item.itemName,
              sellerName: item.addedBy,
              buyerName: payment.email,
              quantity: item.quantity,
              totalPrice: item.totalPrice,
              orderDate: payment.orderDate,
              transaction: payment.transaction,
              status: payment.status,
            });
          });
        });

        let filterSalesReport = result;
        if (search) {
          const lowerSearch = search.toLowerCase();
          filterSalesReport = filterSalesReport.filter(
            (payment) =>
              payment.medicineName.toLowerCase().includes(lowerSearch) ||
              payment.buyerName.toLowerCase().includes(lowerSearch) ||
              payment.sellerName.toLowerCase().includes(lowerSearch) ||
              payment.transaction.toLowerCase().includes(lowerSearch)
          );
        }

        if (sort === "Low to High") {
          filterSalesReport.sort((a, b) => a.totalPrice - b.totalPrice);
        } else if (sort === "High to Low") {
          filterSalesReport.sort((a, b) => b.totalPrice - a.totalPrice);
        } else {
          filterSalesReport.sort(
            (a, b) => new Date(b.orderDate) - new Date(a.orderDate)
          );
        }

        res.send(filterSalesReport);
      }
    );

    app.get("/discount", async (req, res) => {
      const result = await medicinesCollection
        .find({ discount: { $gt: 0 } })
        .toArray();
      console.log(result);
      res.send(result);
    });

    app.get("/all-users", verifyToken, verifyAdmin, async (req, res) => {
      const filter = {
        email: {
          $ne: req?.user?.email,
        },
      };
      const result = await usersCollection
        .find(filter)
        .sort({ created_at: -1 })
        .toArray();
      res.send(result);
    });

    app.get("/user", async (req, res) => {
      const email = req.query.email;
      const result = await usersCollection.findOne({ email });
      res.send(result);
    });

    app.get(
      "/seller-sales-revenue",
      verifyToken,
      verifySeller,
      async (req, res) => {
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
      }
    );

    app.get(
      "/admin-sales-revenue",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
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
      }
    );

    app.get("/manageCategory", verifyToken, verifyAdmin, async (req, res) => {
      const result = await categoryCollection
        .find()
        .sort({ createdAt: -1 })
        .toArray();
      res.send(result);
    });

    app.get(
      "/manageCategorySeller",
      verifyToken,
      verifySeller,
      async (req, res) => {
        const result = await categoryCollection
          .find()
          .sort({ createdAt: -1 })
          .toArray();
        res.send(result);
      }
    );

    app.get("/manageCategoryCard", async (req, res) => {
      const categories = await categoryCollection
        .find()
        .sort({ createdAt: -1 })
        .limit(6)
        .toArray();

      const result = await Promise.all(
        categories.map(async (category) => {
          const count = await medicinesCollection.countDocuments({
            category: category.itemName,
          });
          return { ...category, medicineCount: count };
        })
      );

      res.send(result);
    });
    // app.get("/manageCategoryName", async (req, res) => {
    //   const result = await categoryCollection
    //     .find({}, { projection: { itemName: 1 } })
    //     .toArray();
    //   res.send(result);
    // });

    app.get("/category/:category", async (req, res) => {
      const { category } = req.params;
      const result = await medicinesCollection.find({ category }).toArray();
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

    app.put("/updateCategory/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const category = req.body;
      const updatedDoc = {
        $set: category,
      };
      const result = await categoryCollection.updateOne(filter, updatedDoc);
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

    app.delete("/category-delete/:id", async (req, res) => {
      const { id } = req.params;
      const query = { _id: new ObjectId(id) };
      const result = await categoryCollection.deleteOne(query);
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
