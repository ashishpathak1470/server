const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const app = express();
const PORT = 3000;
const SECRET_KEY = "your_secret_key";
const axios = require("axios");

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  next();
});

app.use(cors(
  {
    origin: "",
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    credentials: true,
  }
));

mongoose
  .connect(
    "mongodb+srv://ashishpathak1470:ashish@cluster0.mv8kklj.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0",
    {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }
  )
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("Error connecting to MongoDB", err));

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
});

const User = mongoose.model("User", userSchema);

const favoriteSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  movies: { type: Array, default: [] },
});

const Favorite = mongoose.model("Favorite", favoriteSchema);

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (token == null) {
    return res.sendStatus(401);
  }

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) {
      return res.sendStatus(403);
    }
    req.user = user;
    next();
  });
};

app.use(express.json());

app.get("/", (req, res) => {
  res.send("You are connected to the server");
});

app.get("/movies", async (req, res) => {
  try {
    const response = await axios.get(
      `http://www.omdbapi.com/?s=${req.query.s}&apikey=e1446db8`
    );
    res.json(response.data);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).send("Invalid email or password");
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).send("Invalid email or password");
    }

    const token = jwt.sign({ userId: user._id }, SECRET_KEY, {
      expiresIn: "1h",
    });
    res.send({ token });
  } catch (error) {
    console.error("Error logging in:", error);
    res.status(500).send("An error occurred during login");
  }
});

app.post("/register", async (req, res) => {
  const { email, password } = req.body;
  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).send("User already exists");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({ email, password: hashedPassword });
    await user.save();

    const token = jwt.sign({ userId: user._id }, SECRET_KEY, {
      expiresIn: "1h",
    });
    res.send({ token });
  } catch (error) {
    console.error("Error registering user:", error);
    res
      .status(500)
      .send(`An error occurred during registration: ${error.message}`);
  }
});

app.get("/favourites", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const favourites = await Favorite.findOne({ userId });
    res.json(favourites ? favourites.movies : []);
  } catch (error) {
    console.error("Error fetching favourites:", error);
    res.status(500).send("An error occurred while fetching favourites");
  }
});

app.post("/favourites", authenticateToken, async (req, res) => {
  const { movie } = req.body;
  try {
    const userId = req.user.userId;
    let favourites = await Favorite.findOne({ userId });
    if (!favourites) {
      favourites = new Favorite({ userId, movies: [movie] });
    } else {
      if (!favourites.movies.find((m) => m.imdbID === movie.imdbID)) {
        favourites.movies.push(movie);
      }
    }
    await favourites.save();
    res.status(201).send("Favourite added successfully");
  } catch (error) {
    console.error("Error adding favourite:", error);
    res.status(500).send("An error occurred while adding favourite");
  }
});

app.delete("/favourites", authenticateToken, async (req, res) => {
  const { movieId } = req.body;
  try {
    const userId = req.user.userId;
    const favourites = await Favorite.findOne({ userId });
    if (favourites) {
      favourites.movies = favourites.movies.filter(
        (movie) => movie.imdbID !== movieId
      );
      await favourites.save();
      res.send("Favourite removed successfully");
    } else {
      res.status(404).send("Favourites not found");
    }
  } catch (error) {
    console.error("Error removing favourite:", error);
    res.status(500).send("An error occurred while removing favourite");
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});