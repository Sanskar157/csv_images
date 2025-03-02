const express = require("express");
const connectDB = require("./config/db");
const uploadRoute = require("./routes/uploadRoute");
const statusRoute = require("./routes/statusRoute");

require("dotenv").config();

const app = express();
connectDB();

app.use(express.json());
app.use("/api", uploadRoute);
app.use("/api", statusRoute);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
