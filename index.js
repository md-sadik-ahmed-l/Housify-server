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
    const bookingDetailsCollection = database.collection("booking_details");
    const favoritesCollection = database.collection("favorites");
    const usersCollection = database.collection("user");

    app.get("/api/properties", async (req, res) => {
      const { userId } = req.query;

      const result = await propertiesCollection
        .find({ userId: userId })
        .toArray();
      res.send(result);
    });

    app.get("/api/profile/all-properties", async (req, res) => {
      const result = await propertiesCollection.find().toArray();
      res.send(result);
    });

    app.get("/api/total/users", async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    app.get("/api/total/bookings", async (req, res) => {
      const result = await bookingDetailsCollection.find().toArray();
      res.send(result);
    });

    app.get("/api/featured-properties", async (req, res) => {
      try {
        const properties = await propertiesCollection
          .find({
            status: "approved", // approved properties only
          })
          .limit(6)
          .toArray();

        res.send(properties);
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    app.get("/api/all-properties", async (req, res) => {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 6;
      const skip = (page - 1) * limit;

      const search = req.query.search || "";
      const propertyType = req.query.propertyType || "";
      const sortOrder = req.query.sort || "";

      const filter = {};

      if (search) {
        filter.$or = [
          { title: { $regex: search, $options: "i" } },
          { location: { $regex: search, $options: "i" } },
        ];
      }

      if (propertyType && propertyType !== "all") {
        filter.propertyType = propertyType;
      }

      let sortOption = {};
      if (sortOrder === "lowToHigh") sortOption.price = 1;
      if (sortOrder === "highToLow") sortOption.price = -1;

      const total = await propertiesCollection.countDocuments(filter);

      const properties = await propertiesCollection
        .find(filter)
        .sort(sortOption)
        .skip(skip)
        .limit(limit)
        .toArray();

      res.send({
        data: properties,
        total,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
      });
    });

    app.get("/api/favorite/properties", async (req, res) => {
      const { tenantUserId } = req.query;

      const result = await favoritesCollection
        .find({ tenantUserId: tenantUserId })
        .toArray();

      res.send(result);
    });

    // Owner Bookings api
    // Owner Bookings api

    app.get("/api/owner-booking/properties", async (req, res) => {
      const { ownerId } = req.query;

      const result = await bookingDetailsCollection
        .find({ ownerId: ownerId })
        .toArray();
      res.send(result);
    });

    app.patch("/api/bookings/:id/approve", async (req, res) => {
      try {
        const { id } = req.params;

        const booking = await bookingDetailsCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!booking) {
          return res.status(404).json({
            success: false,
            message: "Booking not found",
          });
        }

        await bookingDetailsCollection.updateMany(
          {
            propertyId: booking.propertyId,
            _id: { $ne: new ObjectId(id) },
            status: "pending",
          },
          {
            $set: {
              status: "rejected",
            },
          },
        );

        await bookingDetailsCollection.updateOne(
          {
            _id: new ObjectId(id),
          },
          {
            $set: {
              status: "approved",
            },
          },
        );

        res.json({
          success: true,
          message: "Booking approved successfully.",
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          message: error.message,
        });
      }
    });

    app.patch("/api/bookings/:id/reject", async (req, res) => {
      try {
        const { id } = req.params;

        const result = await bookingDetailsCollection.updateOne(
          {
            _id: new ObjectId(id),
          },
          {
            $set: {
              status: "rejected",
            },
          },
        );

        if (!result.matchedCount) {
          return res.status(404).json({
            success: false,
            message: "Booking not found",
          });
        }

        res.json({
          success: true,
          message: "Booking rejected successfully.",
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          message: error.message,
        });
      }
    });

    app.get("/api/tenant-booking/properties", async (req, res) => {
      const { userId } = req.query;

      const result = await bookingDetailsCollection
        .find({ userId: userId })
        .toArray();
      res.send(result);
    });

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

    app.get("/api/favorites/check", async (req, res) => {
      const { tenantUserId, propertyId } = req.query;

      const favorite = await favoritesCollection.findOne({
        tenantUserId,
        propertyId,
      });

      res.send({
        isFavorite: !!favorite,
      });
    });

    app.post("/api/add/favorites", async (req, res) => {
      const favorite = req.body;

      const exists = await favoritesCollection.findOne({
        tenantUserId: favorite.tenantUserId,
        propertyId: favorite.propertyId,
      });

      if (exists) {
        return res.status(409).send({
          success: false,
          message: "Already added",
        });
      }

      const result = await favoritesCollection.insertOne(favorite);

      res.send({
        success: true,
        insertedId: result.insertedId,
      });
    });

    // bookings api
    // bookings api
    // bookings api

    app.get("/api/bookings/check", async (req, res) => {
      try {
        const { userId, propertyId } = req.query;

        const booking = await bookingDetailsCollection.findOne({
          userId,
          propertyId,
        });

        res.json({
          booked: !!booking,
        });
      } catch (err) {
        res.status(500).json({
          booked: false,
        });
      }
    });

    // app.post("/api/bookings/create", async (req, res) => {
    //   const bookingDetails = req.body;
    //   const result = await bookingDetailsCollection.insertOne(bookingDetails);
    //   res.send(result);
    // });

    app.post("/api/bookings/create", async (req, res) => {
      try {
        const bookingDetails = req.body;

        const { userId, propertyId } = bookingDetails;

        // একই user আগে এই property book করেছে কিনা
        const alreadyBooked = await bookingDetailsCollection.findOne({
          userId,
          propertyId,
        });

        if (alreadyBooked) {
          return res.status(409).json({
            success: false,
            message: "You have already booked this property.",
          });
        }

        const result = await bookingDetailsCollection.insertOne(bookingDetails);

        res.json({
          success: true,
          insertedId: result.insertedId,
        });
      } catch (err) {
        res.status(500).json({
          success: false,
          message: err.message,
        });
      }
    });

    // Express server এ এই route যোগ করুন
    app.delete("/api/favorites/remove", async (req, res) => {
      const { tenantUserId, propertyId } = req.query;

      if (!tenantUserId || !propertyId) {
        return res
          .status(400)
          .json({ success: false, message: "Missing params" });
      }

      const result = await favoritesCollection.deleteOne({
        tenantUserId,
        propertyId,
      });

      if (result.deletedCount === 0) {
        return res
          .status(404)
          .json({ success: false, message: "Favorite not found" });
      }

      res.json({ success: true, message: "Removed from favorites" });
    });

    // admin api
    // admin api

    app.get("/api/users", async (req, res) => {
      try {
        const users = await usersCollection.find().toArray();

        res.send(users);
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    app.patch("/api/users/:id/role", async (req, res) => {
      try {
        const { id } = req.params;
        const { role } = req.body;

        if (!["tenant", "owner", "admin"].includes(role)) {
          return res.status(400).json({
            success: false,
            message: "Invalid role",
          });
        }

        const result = await usersCollection.updateOne(
          {
            _id: new ObjectId(id),
          },
          {
            $set: {
              role,
            },
          },
        );

        if (!result.matchedCount) {
          return res.status(404).json({
            success: false,
            message: "User not found",
          });
        }

        res.json({
          success: true,
          message: "Role updated successfully",
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          message: error.message,
        });
      }
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
