import express, { json } from "express";
import { MongoClient, ObjectId } from "mongodb";
import { stripHtml } from "string-strip-html";
import cors from "cors";
import chalk from "chalk";
import Joi from "joi";
import dayjs from "dayjs";
import dotenv from "dotenv";

dotenv.config();
const mongoClient = new MongoClient(process.env.MONGO_URI);
let db;
mongoClient.connect(() => (db = mongoClient.db("projeto12-batepapo-uol-api")));

const signInSchema = Joi.object({
  name: Joi.string().required(),
});

const bodyMessageSchema = Joi.object({
  to: Joi.string().required(),
  text: Joi.string().required(),
  type: Joi.string().valid("message", "private_message").required(),
});

const app = express();
app.use(json());
app.use(cors());

setInterval(async () => {
  try {
    const users = await db.collection("Users").find({}).toArray();
    const time = Date.now();
    const disconnectedUsers = users.filter(
      (user) => time - parseInt(user.lastStatus) > 15000
    );
    disconnectedUsers.map(async (user) => {
      await db.collection("Users").deleteOne({ name: user.name });
      const message = {
        from: user.name,
        to: "Todos",
        text: "sai na sala...",
        type: "status",
        time: dayjs(Date.now()).format("HH:mm:ss"),
      };
      await db.collection("Messages").insertOne(message);
    });
  } catch (error) {
    console.log(error);
  }
}, 15000);

app.get("/participants", async (req, res) => {
  try {
    const participants = await db.collection("Users").find({}).toArray();
    res.send(participants);
  } catch (error) {
    console.log(error);
    res.sendStatus(500);
  }
});

app.post("/participants", async (req, res) => {
  try {
    const validation = await signInSchema.validateAsync(req.body);
    const name = stripHtml(validation.name).result.trim();
    const user = await db.collection("Users").findOne({ name });
    if (!user) {
      const newUser = {
        name,
        lastStatus: Date.now(),
      };
      const message = {
        from: name,
        to: "Todos",
        text: "entra na sala...",
        type: "status",
        time: dayjs(Date.now()).format("HH:mm:ss"),
      };
      await db.collection("Users").insertOne(newUser);
      await db.collection("Messages").insertOne(message);
      res.status(201).send(name);
    } else {
      res.sendStatus(409);
    }
  } catch (error) {
    if (error.isJoi === true) {
      res.status(422).send(error.message);
      return;
    }
    console.log(error);
    res.sendStatus(500);
  }
});

app.post("/messages", async (req, res) => {
  try {
    const user = stripHtml(req.headers.user).result.trim();
    const users = await db.collection("Users").find().toArray();
    if (users.length === 0) {
      res.status(422).send("Não há participantes ativos!");
      return;
    }
    const usersNames = users.map(({ name }) => name);
    const headerSchema = Joi.object({
      from: Joi.string()
        .valid(...usersNames)
        .required(),
    });

    const bodyValidation = await bodyMessageSchema.validateAsync(req.body, {
      abortEarly: false,
    });
    const fromValidation = await headerSchema.validateAsync({ from: user });
    const message = {
      from: stripHtml(fromValidation.from).result.trim(),
      to: stripHtml(bodyValidation.to).result.trim(),
      text: stripHtml(bodyValidation.text).result.trim(),
      type: stripHtml(bodyValidation.type).result.trim(),
      time: dayjs(Date.now()).format("HH:mm:ss"),
    };
    await db.collection("Messages").insertOne(message);
    res.sendStatus(201);
  } catch (error) {
    if (error.isJoi === true) {
      res.status(422).send(error.message);
      return;
    }
    console.log(error);
    res.sendStatus(500);
  }
});

app.get("/messages", async (req, res) => {
  try {
    const { limit } = req.query;
    const { user } = req.headers;
    const users = await db.collection("Users").find().toArray();
    const usersNames = users.map(({ name }) => name);
    const headerSchema = Joi.object({
      user: Joi.string()
        .valid(...usersNames)
        .required(),
    });
    const headerValidation = await headerSchema.validateAsync({ user });

    const messages = await db
      .collection("Messages")
      .find({
        $or: [
          { from: headerValidation.user },
          { to: headerValidation.user },
          { type: { $in: ["message", "status"] } },
        ],
      })
      .toArray();
    if (!limit) {
      res.send(messages);
      return;
    }
    res.send(messages.slice(-limit));
  } catch (error) {
    if (error.isJoi === true) {
      res.status(422).send(error.message);
      return;
    }
    console.log(error);
    res.sendStatus(500);
  }
});

app.post("/status", async (req, res) => {
  try {
    const { user } = req.headers;
    const users = await db.collection("Users").find().toArray();
    const usersNames = users.map(({ name }) => name);
    const headerSchema = Joi.object({
      user: Joi.string()
        .valid(...usersNames)
        .required(),
    });
    const headerValidation = await headerSchema.validateAsync({ user });
    await db
      .collection("Users")
      .updateOne(
        { name: headerValidation.user },
        { $set: { lastStatus: Date.now() } }
      );
    res.sendStatus(200);
  } catch (error) {
    if (error.isJoi === true) {
      res.sendStatus(404);
      return;
    }
    console.log(error);
    res.sendStatus(500);
  }
});

app.delete("/messages/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const message = await db
      .collection("Messages")
      .findOne({ _id: new ObjectId(id) });
    console.log(message);
    if (!message) {
      res.sendStatus(404);
      return;
    }
    if (message.from !== stripHtml(req.headers.user).result.trim()) {
      res.sendStatus(401);
      return;
    }
    await db.collection("Messages").deleteOne({ _id: new ObjectId(id) });
    res.sendStatus(200);
  } catch (error) {
    console.log(error);
    res.sendStatus(500);
  }
});

app.listen(5000, () => console.log(chalk.bold.green("Servidor Online!")));
