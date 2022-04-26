import express, { json } from "express";
import cors from "cors";
import chalk from "chalk";
import Joi from "joi";

const schema = Joi.object({
  name: Joi.string().required(),
});

const users = [];

const app = express();
app.use(json());
app.use(cors());

app.post("/participants", (req, res) => {
  const { error, value } = schema.validate(req.body);
  console.log(value);
  if (error) {
    res.status(422).send(error.message);
    return;
  }
  res.sendStatus(200);
  users.push({ name: value.name, lastStatus: Date.now(0) });
  console.log(users);
});

app.listen(5000, () => console.log(chalk.bold.green("Servidor Online!")));
