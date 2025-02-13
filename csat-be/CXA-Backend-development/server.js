const express = require("express");
const dotenv = require("dotenv");
const authRoutes = require("./routes/auth");
const cors = require('cors');
const path = require("path");
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
dotenv.config();
console.log("Email User:", process.env.EMAIL_USER);
dotenv.config();
const app = express();

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.json());
app.use(cookieParser());
app.use(bodyParser.json());
/*app.use(cors({
  origin: 'http://35.91.75.215', 
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE', 
  credentials: true,
  allowedHeaders: 'Content-Type, Authorization'
}));
*/
app.use(cors({
  origin: 'http://35.91.75.215',
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS', // Ensure OPTIONS is included
  credentials: true,
  allowedHeaders: 'Content-Type, Authorization'
}));
app.options('*', (req, res) => {
  res.header("Access-Control-Allow-Origin", "http://35.91.75.215");
  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, PATCH, DELETE");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  res.sendStatus(200);
});

app.use("/api/auth", authRoutes);
app._router.stack.forEach((layer) => {
  if (layer.route) {
      console.log(`Route: ${Object.keys(layer.route.methods)[0].toUpperCase()} ${layer.route.path}`);
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
