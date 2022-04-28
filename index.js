import express, { json } from "express";
import { MongoClient } from "mongodb";
import cors from "cors";
import chalk from "chalk";
import Joi from "joi";
import dayjs from "dayjs";
import dotenv from "dotenv";

dotenv.config();
const mongoClient = new MongoClient(process.env.MONGO_URI);

const schema = Joi.object({
  name: Joi.string().required(),
});

const app = express();
app.use(json());
app.use(cors());

app.post("/participants", async (req, res) => {
  try {
    const { error, value } = schema.validate(req.body);
    if (error) {
      res.status(422).send(error.message);
      return;
    }
    const { name } = value;
    await mongoClient.connect();
    const dbChat = mongoClient.db("projeto12-batepapo-uol-api");
    const dbChatUsers = dbChat.collection("Users");
    const dbChatMessages = dbChat.collection("Messages");
    const user = await dbChatUsers.findOne({ name });
    if (!user) {
      const newUser = {
        name,
        lastStatus: Date.now(),
      };
      const message = {
        from: value.name,
        to: "Todos",
        text: "entra na sala...",
        type: "status",
        time: dayjs(Date.now()).format("hh:mm:ss"),
      };
      await dbChatUsers.insertOne(newUser);
      await dbChatMessages.insertOne(message);
      res.sendStatus(201);
    } else {
      res.sendStatus(409);
    }
  } catch (error) {
    console.log(error);
    res.sendStatus(500);
  }
});

app.listen(5000, () => console.log(chalk.bold.green("Servidor Online!")));
