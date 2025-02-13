const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/"); // Ensure this is the desired folder
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname); // Keeps the original name
  },
});

const upload = multer({ storage });
module.exports = upload;
