const express = require("express");
const bodyParser = require("body-parser");
require("dotenv").config();
const mongodb = require("mongodb");
const cors = require("cors");
const bcrypt = require("bcrypt");
var jwt = require("jsonwebtoken");
const app = express();
app.use(cors());
app.use(bodyParser.json());
const port = process.env.PORT || 4040;

const url = "mongodb+srv://bloodbank:bloodbankPassword@bloodbank.dxpar.mongodb.net/<dbname>?retryWrites=true&w=majority";
const jwtTK = process.env.JWTTK;

function authorize(req, res, next) {
  try {
    if (req.headers.auth !== undefined) {
      let jwtmessage = jwt.verify(req.headers.auth, jwtTK);
      res.locals.user = jwtmessage.user;
      next();
    } else {
      res.status(404).json({ message: "authorization failed" });
    }
  } catch (err) {
    console.log(err);
    res.status(404).json({ message: "authorization failed" });
  }
}

app.get("/", async (req, res) => {
  res.send("Blood Bank Application");
});

app.post("/signin", async (req, res) => {
  const user = req.body;
  try {
    var data;
    const client = await mongodb.connect(url, { useUnifiedTopology: true });
    const db = client.db("bloodbank");
    var hospitalSignIn = await db
      .collection("hospitals")
      .findOne({ email: user.email });
    var receiverSignIn = await db
      .collection("receivers")
      .findOne({ email: user.email });
    if (hospitalSignIn === null && receiverSignIn === null) {
      res.status(404).json({ message: "User does not exists" });
      return;
    }
    if (hospitalSignIn !== null) {
      data = hospitalSignIn;
    } else if (receiverSignIn !== null) {
      data = receiverSignIn;
    }
    const result = await bcrypt.compare(user.password, data.password);
    if (result) {
      delete data.password;
      let jwtToken = jwt.sign({ user: data }, jwtTK);
      res.json({ message: "success", user: data, jwtToken: jwtToken });
    } else {
      res.json({ message: "Password not matching" });
    }
  } catch (err) {
    console.log(err);
    res.json({ message: "failed" });
  }
});

app.post("/signupreceiver", async (req, res) => {
  var receiver = req.body;
  receiver.type = "receiver";
  try {
    const client = await mongodb.connect(url, { useUnifiedTopology: true });
    const db = client.db("bloodbank");
    const data = await db
      .collection("receivers")
      .findOne({ email: receiver.email });
    const data1 = await db
      .collection("hospitals")
      .findOne({ email: receiver.email });
    if (data !== null || data1 !== null) {
      res.json({ message: "User already exists" });
      return;
    }
  } catch (err) {
    console.log(err);
    res.json({ message: "failed" });
    return;
  }
  var hash = await bcrypt.hash(receiver.password, 10);
  receiver.password = hash;
  try {
    const client = await mongodb.connect(url, { useUnifiedTopology: true });
    const db = client.db("bloodbank");
    const data = await db.collection("receivers").insertOne(receiver);
    await client.close();
    res.json({ message: "success" });
  } catch (err) {
    console.log(err);
    res.json({ message: "failed" });
  }
});

app.post("/signuphospital", async (req, res) => {
  var hospital = req.body;
  hospital.type = "hospital";
  hospital.bloodInfo = [];
  try {
    const client = await mongodb.connect(url, { useUnifiedTopology: true });
    const db = client.db("bloodbank");
    const data = await db
      .collection("hospitals")
      .findOne({ email: hospital.email });
    const data1 = await db
      .collection("receivers")
      .findOne({ email: hospital.email });
    if (data !== null || data1 !== null) {
      res.json({ message: "User already exists" });
      return;
    }
  } catch (err) {
    console.log(err);
    res.json({ message: "failed" });
    return;
  }
  var hash = await bcrypt.hash(hospital.password, 10);
  hospital.password = hash;
  try {
    const client = await mongodb.connect(url, { useUnifiedTopology: true });
    const db = client.db("bloodbank");
    const data = await db.collection("hospitals").insertOne(hospital);
    await client.close();
    res.json({ message: "success" });
  } catch (err) {
    console.log(err);
    res.json({ message: "failed" });
  }
});

app.get("/gettype", [authorize], async (req, res) => {
  try {
    var data;
    const client = await mongodb.connect(url, { useUnifiedTopology: true });
    const db = client.db("bloodbank");
    var hospitalData = await db
      .collection("hospitals")
      .findOne({ email: res.locals.user.email });
    var receiverData = await db
      .collection("receivers")
      .findOne({ email: res.locals.user.email });
    // if (hospitalData === null && receiverData === null) {
    //   res.status(404).json({ message: "User does not exists" });
    //   return;
    // }
    if (receiverData !== null) {
      data = receiverData;
    } else if (hospitalData !== null) {
      data = hospitalData;
    }
    res.json({
      type: data.type,
      receiverName: data.name,
      phoneNumber: data.phoneNumber,
    });
    return;
  } catch (err) {
    console.log(err);
    res.json({ message: "failed" });
  }
});

app.post("/addbloodinfo", [authorize], async (req, res) => {
  const bloodInfo = req.body;
  try {
    // var data;
    const client = await mongodb.connect(url, { useUnifiedTopology: true });
    const db = client.db("bloodbank");
    var hospitalData = await db
      .collection("hospitals")
      .findOne({ email: res.locals.user.email });
    if (hospitalData) {
      var updateData = await db
        .collection("hospitals")
        .updateOne(
          { email: res.locals.user.email },
          { $push: { bloodInfo: bloodInfo } }
        );
    }
    await client.close();
    res.json({ message: "success" });
    return;
  } catch (err) {
    console.log(err);
    res.json({ message: "failed" });
  }
});

app.post("/sendsamplereq", [authorize], async (req, res) => {
  const sampleReqData = req.body;
  try {
    const client = await mongodb.connect(url, { useUnifiedTopology: true });
    const db = client.db("bloodbank");
    var bloodData = await db
      .collection("hospitals")
      .updateOne(
        { email: sampleReqData.email },
        {
          $push: {
            RequestedSamples: {
              bloodGroup: sampleReqData.bloodGroup,
              RequestedBy: sampleReqData.receiverName,
              phoneNumber: sampleReqData.phoneNumber,
            },
          },
        }
      );
    // delete bloodData.password;
    await client.close();
    res.json({ message: "success", data: bloodData });
    return;
  } catch (err) {
    console.log(err);
    res.json({ message: "failed" });
  }
});

app.get("/getblooddata", [authorize], async (req, res) => {
  try {
    const client = await mongodb.connect(url, { useUnifiedTopology: true });
    const db = client.db("bloodbank");
    var bloodData = await db
      .collection("hospitals")
      .findOne({ email: res.locals.user.email });
    delete bloodData.password;
    await client.close();
    res.json({ message: "success", data: bloodData });
    return;
  } catch (err) {
    console.log(err);
    res.json({ message: "failed" });
  }
});

app.get("/getsamplerequests", [authorize], async (req, res) => {
  try {
    const client = await mongodb.connect(url, { useUnifiedTopology: true });
    const db = client.db("bloodbank");
    var bloodData = await db
      .collection("hospitals")
      .findOne({ email: res.locals.user.email });
    delete bloodData.password;
    await client.close();
    res.json({ message: "success", data: bloodData });
    return;
  } catch (err) {
    console.log(err);
    res.json({ message: "failed" });
  }
});

app.get("/availablesamples", async (req, res) => {
  try {
    const client = await mongodb.connect(url, { useUnifiedTopology: true });
    const db = client.db("bloodbank");
    var bloodData = await db
      .collection("hospitals")
      .find({ type: "hospital" })
      .toArray();
    await client.close();
    res.json({ message: "success", data: bloodData });
    return;
  } catch (err) {
    console.log(err);
    res.json({ message: "failed" });
  }
});

app.listen(port, () => {
  console.log(`Listening to the port ${port}`);
});
