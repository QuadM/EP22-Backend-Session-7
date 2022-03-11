const router = require("express").Router();
const Joi = require("joi");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const User = require("../models/User.js"); //import User model
const auth = require("../middleware/auth.js");
const sendMail = require("../helpers/mailer.js");
const Token = require("../models/Token.js");

const signUpSchema = Joi.object({
  email: Joi.string().email().required(),
  pw1: Joi.string().alphanum().min(8).max(16).required(),
  pw2: Joi.ref("pw1"),
  username: Joi.string().min(3).max(30).required(),
  age: Joi.number().min(13).required(),
  phone: Joi.number().required(),
  role: Joi.string().required(),
});

const signInSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().alphanum().min(8).max(16).required(),
});

//get all users
router.get("/", async (req, res) => {
  try {
    //store all users in the database in a variable
    const users = await User.find();
    res.status(200).json({ users });
  } catch (err) {
    res.status(500).json({ err });
  }
});

//get a user with given username
router.get("/:username", auth, async (req, res) => {
  try {
    const { username } = req.params;
    const user = await User.findOne({ username });
    if (user && req.payload.username === user.username) {
      res.status(200).json({ user });
    } else {
      res.sendStatus(404);
    }
  } catch (err) {
    res.status(500).json({ err });
  }
});

// add user to the database
router.post("/signup", async (req, res) => {
  const { error } = signUpSchema.validate(req.body, { abortEarly: false });

  if (error) {
    const errorObject = {};
    error.details.forEach((err) => {
      errorObject[err.path[0]] = err.message;
    });
    console.log(errorObject);
    return res.status(422).send(errorObject);
  }

  try {
    const { username, email, pw1, pw2, age, phone } = req.body;

    const takenUsername = await User.findOne({ username });

    // check whether the username is taken or not
    if (takenUsername) {
      return res.status(400).json({ error: "username is taken" });
    }

    if (pw1 === pw2) {
      const salt = await bcrypt.genSalt(10);
      const hashed = await bcrypt.hash(pw1, salt);
      const user = new User({ username, email, password: hashed, age, phone });
      const token = jwt.sign({ email, username }, process.env.JWT_PRIVATE_KEY);

      const verificationToken = await new Token({
        username,
        token: crypto.randomBytes(32).toString("hex"),
      }).save();

      await user.save();

      const message = `
        Thank you for your registration. Please verify your email via the following link.\n
        ${process.env.BASE_URL}/users/verify/${username}/${verificationToken.token}
      `;

      await sendMail(email, "Welcome to Energia Powered", message);

      res
        .status(201)
        .header("x-auth-token", token)
        .json({ message: "user created successfully" });
    } else {
      res.status(400).json({ error: "passwords doesn't match" });
    }
  } catch (err) {
    console.log(err);
    return res.status(500).send(err);
  }
});

router.get("/verify/:username/:token", async (req, res) => {
  const user = await User.findOne({ username: req.params.username });

  if (!user) {
    return res.status(400).json({ error: "Invalid token" });
  }

  const token = await Token.findOne({
    username: req.params.username,
    token: req.params.token,
  });

  if (!token) {
    return res.status(400).json({ error: "Invalid token" });
  }

  await User.findOneAndUpdate(
    { username: req.params.username },
    { verified: true }
  );
  await Token.findByIdAndRemove(token._id);

  res.status(200).json({ message: "User verified successfully" });
});

//user signin
router.post("/signin", async (req, res) => {
  const { error } = signInSchema.validate(req.body);
  if (error) {
    const errorObject = {};
    error.details.forEach((err) => {
      errorObject[err.path[0]] = err.message;
    });
    console.log(errorObject);
    return res.status(422).send(errorObject);
  }
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    const isValid = await bcrypt.compare(password, user.password);
    if (user && isValid) {
      res
        .status(200)
        .header(
          "x-auth-token",
          jwt.sign(
            { email: user.email, username: user.username },
            process.env.JWT_PRIVATE_KEY
          )
        )
        .json({ message: "sign in successfully" });
    } else {
      res.status(400).send("Invalid email or password");
    }
  } catch (err) {
    res.status(500).json({ err });
  }
});

//update user's info with the given username
router.put("/:username", async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username });
    if (user) {
      await User.updateOne({ username: req.params.username }, req.body);
      return res.status(201).send("User updated successfully");
    }
    return res.sendStatus(404);
  } catch (err) {
    console.log(err);
    return res.status(500).send(err);
  }
});

//delete the user with the given username
router.delete("/:username", async (req, res) => {
  try {
    const { deletedCount } = await User.deleteOne({
      username: req.params.username,
    });
    if (deletedCount == 0) {
      console.log("No user with that username");
      return res.status(400).send("No user with that username");
    }
    return res.status(200).send("User deleted");
  } catch (err) {
    console.log(err);
    return res.status(500).send(err);
  }
});

module.exports = router;
