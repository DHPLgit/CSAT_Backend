const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const db = require("../config/db");
// const cookieParser = require("cookie-parser");
const cookie = require("cookie");
const nodemailer = require("nodemailer");
const { log } = require("winston");

let refreshTokens = [];
/*
exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    console.log("Fetching user based on email...");
    // Fetch user based on email
    const [userResults] = await db.query(
      "SELECT * FROM nps_users WHERE email = ?",
      [email]
    );

    if (userResults.length === 0) {
      console.log("User not found.");
      return res
        .status(401)
        .json({ message: "Authentication failed. User not found." });
    }

    const user = userResults[0];

    console.log("User found:", user);

    // Explicitly cast status to a number and check if it is 1
    if (Number(user.status) !== 1) {
      console.log("User account is not activated.");
      return res
        .status(403)
        .json({ message: "Account not activated. Please activate your account." });
    }

    // Verify password
    const isPasswordValid = bcrypt.compareSync(password, user.password);

    if (!isPasswordValid) {
      console.log("Wrong password.");
      return res
        .status(401)
        .json({ message: "Authentication failed. Please check Email and Password" });
    }

    console.log("Password valid. Generating tokens...");

    // Ensure ACCESS_TOKEN_SECRET and REFRESH_TOKEN_SECRET are defined
    if (!process.env.ACCESS_TOKEN_SECRET || !process.env.REFRESH_TOKEN_SECRET) {
      console.error(
        "ACCESS_TOKEN_SECRET or REFRESH_TOKEN_SECRET is not defined."
      );
      return res
        .status(500)
        .json({ message: "Internal server error. Please try again later." });
    }

    // Generate access token
    const accessToken = jwt.sign(
      {
        email: user.email,
        userId: user.id,
        tenantId: user.tenant_id,
      },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: "1h" }
    );

    // Generate refresh token
    const refreshToken = jwt.sign(
      {
        email: user.email,
        userId: user.id,
        tenantId: user.tenant_id,
      },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: "7d" }
    );

    console.log("Tokens generated successfully.");

    return res.status(200).json({
      message: "Authentication successful",
      accessToken: accessToken,
      refreshToken: refreshToken,
      user_id: user.id,
      tenant_id: user.tenant_id,
    });
  } catch (err) {
    console.error("Error during login:", err);
    res
      .status(500)
      .json({ message: "Unexpected error occurred", error: err.message });
  }
};
*/

function generateAccessToken(user) {
  const data2 = { user_id: user.id, tenant_id: user.tenant_id }
  return jwt.sign(
   {data:data2}, 
    process.env.ACCESS_TOKEN_SECRET, 
    { expiresIn: '10m' } // Access token expires in 10 minutes
  );
}

function generateRefreshToken(user) {
  return jwt.sign(
    { id: user.id, tenant_id: user.tenant_id }, 
    process.env.REFRESH_TOKEN_SECRET, 
    { expiresIn: '1d' } // Refresh token expires in 1 days
  );
}

// exports.login = async (req, res) => {
//   const { email, password } = req.body;

//   try {
//     const [userResults] = await db.query(
//       "SELECT * FROM nps_users WHERE email = ?",
//       [email]
//     );

//     if (userResults.length === 0) {
//       return res
//         .status(401)
//         .json({ message: "Authentication failed. User not found." });
//     }

//     const user = userResults[0];

//     if (Number(user.status) !== 1) {
//       return res
//         .status(403)
//         .json({ message: "Account not activated. Please activate your account." });
//     }

//     const isPasswordValid = bcrypt.compareSync(password, user.password);
//     if (!isPasswordValid) {
//       return res.status(401).json({
//         message: "Authentication failed. Please check Email and Password.",
//       });
//     }

//     const accessToken = generateAccessToken(user);
//     const refreshToken = generateRefreshToken(user);

//     refreshTokens.push(refreshToken);

//     return res.status(200).json({
//       message: "Authentication successful",
//       accessToken,
//       refreshToken,
//       user_id: user.id,
//       tenant_id: user.tenant_id,
//     });
//     } catch (err) {
//       console.error("Error during login:", err);
//       return res.status(500).json({
//         message: "Unexpected error occurred.",
//         error: err.message,
//       });
//     }
//   };
exports.login = async (req, res) => {
  const { email, password, tenant_name } = req.body;

  try {
    const [userResults] = await db.query(
      `SELECT u.*, t.tenant_name FROM nps_users u
       JOIN nps_tenant t ON u.tenant_id = t.tenant_id
       WHERE u.email = ? AND t.tenant_name = ?`,
      [email, tenant_name]
    );

    if (userResults.length === 0) {
      return res
        .status(401)
        .json({ message: "Authentication failed. User or Tenant not found." });
    }

    const user = userResults[0];

    if (Number(user.status) !== 1) {
      return res
        .status(403)
        .json({ message: "Account not activated. Please activate your account." });
    }

    const isPasswordValid = bcrypt.compareSync(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        message: "Authentication failed. Please check Email and Password.",
      });
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    refreshTokens.push(refreshToken);

    return res.status(200).json({
      message: "Authentication successful",
      accessToken,
      refreshToken,
      user_id: user.id,
      tenant_id: user.tenant_id,
      tenant_name: user.tenant_name,
    });
  } catch (err) {
    console.error("Error during login:", err);
    return res.status(500).json({
      message: "Unexpected error occurred.",
      error: err.message,
    });
  }
};


// exports.validateToken = (req, res) => {

//   const authHeader = req.headers['authorization'];
//   const token = authHeader && authHeader.split(' ')[1];
//   const refreshToken = req.cookies?.refreshToken || req.headers["x-refresh-token"];

//   if (!token) {
//     return res.status(401).json({ message: "Access token is required." });
//   }

//   jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
//     if (err) {
//       return res.status(401).json({ message: "Invalid or expired token." });
//     }

//     return res.status(200).json({
//       message: "Token is valid.",
//       accessToken: token,
//       refreshToken: refreshToken,
//       user_id: decoded.id,
//       tenant_id: decoded.tenant_id,
//     });
//   });
// };

// exports.login = async (req, res) => {
//   const { email, password, tenant_name } = req.body;

//   // If JWT token is present in cookies
//   if (req.cookies.jwt_token) {
//     try {
//       const token = req.cookies.jwt_token;

//       // Verify the token using the access token secret
//       const user = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

//       return res.json({
//         message: "Authentication Successful",
//         user_id: user.id,
//         tenant_id: user.tenant_id,
//         accessToken: req.cookies.jwt_token,
//         refreshToken: req.cookies.jwt_token,
//       });
//     } catch (error) {
//       res.clearCookie('jwt_token', { httpOnly: true, secure: true, path: '/' });
//       return res.status(403).json({ message: error.message });
//     }
//   }

//   try {
//     // Fetch user details
//     const [userResults] = await db.query(
//       "SELECT id, tenant_id, email, password FROM nps_users WHERE email = ?",
//       [email]
//     );

//     if (userResults.length === 0) {
//       return res.status(400).json({ message: "Invalid Email" });
//     }

//     const user = userResults[0];

//     // Fetch tenant details
//     const [tenantResults] = await db.query(
//       "SELECT * FROM nps_tenant WHERE tenant_id = ?",
//       [user.tenant_id]
//     );

//     if (
//       tenantResults.length === 0 ||
//       tenantResults[0].tenant_name !== tenant_name
//     ) {
//       return res.status(400).json({ message: "Invalid Tenant Name" });
//     }

//     const isPasswordValid = bcrypt.compareSync(password, user.password);
//     if (!isPasswordValid) {
//       return res.status(400).json({ message: "Invalid Password" });
//     }

//     // Generate distinct tokens
//     const accessToken = generateAccessToken(user);
//     const refreshToken = generateRefreshToken(user);

//     refreshTokens.push(refreshToken);

//     // Set cookie for access token
//     // res.setHeader(
//     //   "Set-Cookie",
//     //   cookie.serialize("jwt_token", accessToken, {
//     //     httpOnly: true, // Only accessible by HTTP
//     //     path: "/", // Cookie is valid across the whole site
//     //     maxAge: 3600, // Cookie expires after 1 hour
//     //     domain: "localhost", // Change domain for production
//     //   })
//     // );
//     res.setHeader(
//       "Set-Cookie",
//       cookie.serialize("jwt_token", accessToken, {
//         httpOnly: true, // Only accessible by HTTP
//         path: "/", // Cookie is valid across the whole site
//         maxAge: 3600, // Cookie expires after 1 hour
//         domain: "localhost", // Change domain for production
//         secure: false, // Should be true for HTTPS
//         sameSite: "Strict", // or "Lax" depending on your use case
//       })
//     );
    

//     // Send response
//     res.json({
//       message: "Authentication Successful",
//       user_id: user.id,
//       tenant_id: user.tenant_id,
//       accessToken,
//       refreshToken,
//     });
//   } catch (err) {
//     console.error("Database error:", err);
//     res.status(500).json({ message: "Database error", error: err.message });
//   }
// };

// exports.refreshToken = (req, res) => {
//   const { token } = req.body;

//   if (!token) return res.sendStatus(401);
//   if (!refreshTokens.includes(token)) return res.sendStatus(403);

//   jwt.verify(token, process.env.REFRESH_TOKEN_SECRET, (err, user) => {
//     if (err) return res.sendStatus(403);

//     const newAccessToken = generateAccessToken(user);
//     res.json({ accessToken: newAccessToken });
//   });
// };


exports.validateToken = (req, res) => {
  const { token } = req.body; // Get token from request body

  if (!token) {
    return res.status(401).json({ message: "Access token is required." });
  }

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(200).json({ message: "Invalid or expired token." });
    }

    return res.status(201).json({
      message: "Token is valid.",
      accessToken: token,
      user_id: decoded.data.user_id,
      tenant_id: decoded.data.tenant_id,
    });
  });
};

exports.refreshToken = (req, res) => {
  const { token } = req.body;

  if (!token) {
    console.error("No token provided");
    return res.status(401).json({ message: "No token provided" });
  }

  if (!refreshTokens.includes(token)) {
    console.error("Invalid refresh token");
    return res.status(403).json({ message: "Invalid refresh token" });
  }

  jwt.verify(token, process.env.REFRESH_TOKEN_SECRET, (err, user) => {
    if (err) {
      console.error("Token verification failed:", err.message);
      return res.status(403).json({ message: "Token verification failed" });
    }

    console.log("Token verified successfully, user:", user);

    // Generate new access token
    const newAccessToken = generateAccessToken(user);

    console.log("New access token generated:", newAccessToken);

    res.json({ accessToken: newAccessToken });
  });
};


const transporter = require("../config/email");

const generateResetToken = () => {
  const expirationTime = Date.now() + 60 * 60 * 1000;
  const token = Math.random().toString(36).slice(2);
  return { token, expirationTime };
};

exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const [rows] = await db.query(
      "SELECT id, tenant_id FROM nps_users WHERE email = ?",
      [email]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Email not found" });
    }

    const { id, tenant_id } = rows[0];
    const { token, expirationTime } = generateResetToken();

    await db.query("UPDATE nps_users SET password_key = ? WHERE id = ?", [
      token,
      id,
    ]);

    const resetLink = `http://localhost:3000/Reset_password?token=${token}&expiresAt=${expirationTime}`;

    const emailResponse = await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Password Reset Request",
      html: `
        <h1>Password Reset</h1>
        <p>Click the link below to reset your password:</p>
        <a href="${resetLink}">Reset Password</a>
      `,
    });

    console.log("Email sent:", emailResponse);

    res.status(200).json({
      message: "Password reset email sent successfully",
      token: token,
    });
  } catch (error) {
    console.error("Error in forgotPassword API:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};

exports.resetPassword = async (req, res) => {
  const { token, newPassword, confirmPassword } = req.body;

  if (newPassword !== confirmPassword) {
    return res.status(400).json({ message: "Passwords do not match" });
  }

  try {
    console.log("Received token:", token);

    const [rows] = await db.query(
      "SELECT id, password_key FROM nps_users WHERE password_key = ?",
      [token]
    );
    if (rows.length === 0) {
      console.log("No user found with the given token");
      return res.status(400).json({ message: "Invalid token" });
    }

    const user = rows[0];
    console.log("User found:", user);
    console.log("Stored Token:", user.password_key);

    if (token !== user.password_key) {
      console.log("Tokens do not match");
      return res.status(400).json({ message: "Invalid token" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.query(
      "UPDATE nps_users SET password = ?, password_key = NULL WHERE id = ?",
      [hashedPassword, user.id]
    );

    res.status(200).json({ message: "Password reset successfully" });
  } catch (error) {
    console.error("Token validation error:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};

exports.signup = async (req, res) => {
  const {
    phone_no,
    email,
    password,
    firstname,
    lastname,
    username,
    tenant_name,
  } = req.body;

  // Validation for firstname, lastname, and tenant_name

  const nameRegex = /^[A-Za-z\s]+$/;

  if (!nameRegex.test(firstname)) {
    return res
      .status(400)
      .json({ message: "Firstname must contain only alphabets and spaces" });
  }

  if (!nameRegex.test(lastname)) {
    return res
      .status(400)
      .json({ message: "Lastname must contain only alphabets and spaces" });
  }

  if (!nameRegex.test(tenant_name)) {
    return res
      .status(400)
      .json({ message: "Tenant name must contain only alphabets and spaces" });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);

  try {
    const [phone_noResults] = await db.query(
      "SELECT tenant_id FROM nps_users WHERE phone_no = ?",

      [phone_no]
    );

    if (phone_noResults.length > 0) {
      return res.status(400).json({ message: "Phone number already exists" });
    }

    const [emailResults] = await db.query(
      "SELECT tenant_id FROM nps_users WHERE email = ?",

      [email]
    );

    if (emailResults.length > 0) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const connection = await db.getConnection();

    await connection.beginTransaction();

    try {
      const [tenantInsertResult] = await connection.query(
        "INSERT INTO nps_tenant (tenant_name) VALUES (?)",

        [tenant_name]
      );

      const tenantId = tenantInsertResult.insertId;
      const [userInsertResult] = await connection.query(
        "INSERT INTO nps_users (phone_no, email, password, firstname, lastname, username, tenant_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [phone_no, email, hashedPassword, firstname, lastname, username, tenantId, '0'] // Set status to '0'
      );

      const userId = userInsertResult.insertId;
      await connection.commit();
      const transporter = nodemailer.createTransport({
        service: "gmail",

        auth: {
          user: process.env.EMAIL_USER,

          pass: process.env.EMAIL_PASS,
        },
      });

      const activationLink = `http://localhost:3000/activate?id=${userId}&tenant_id=${tenantId}`;

      await transporter.sendMail({
        from: process.env.EMAIL_USER,

        to: email,

        subject: "Welcome to Our Service! Activate Your Account",

        html: `

          <div style="font-family: Arial, sans-serif; line-height: 1.6;">
            <h1 style="color: #333;">Welcome to Our Service!</h1>
            <p>Dear ${firstname} ${lastname},</p>
            <p>Thank you for registering with us. We're thrilled to have you on board. Please click the link below to activate your account and get started:</p>
            <a href="${activationLink}" style="display: inline-block; padding: 10px 20px; margin: 10px 0; font-size: 16px; color: white; background-color: #007bff; text-decoration: none; border-radius: 5px;">Activate Your Account</a>
            <p>If you did not sign up for this account, please ignore this email.</p>
            <p>Best regards,</p>
            <p>Your Company Team</p>
            <hr>
            <p style="font-size: 12px; color: #777;">If you have any questions, feel free to reach out to our support team at support@yourcompany.com.</p>
            <p style="font-size: 12px; color: #777;">© 2025 Your Company. All rights reserved.</p>
          </div>
        `,
      });

      res
        .status(201)
        .json({ message: "User registered. Activation email sent." });
    } catch (err) {
      console.error("Error during Tenant DB:", err);
      await connection.rollback();
      if (!res.headersSent) {
        res
          .status(500)
          .json({ message: "Error during Tenant creation", error: err.message });
      }
    }
  } catch (err) {
    console.error("Error during signup:", err);

    if (!res.headersSent) {
      res
        .status(500)
        .json({ message: "Unexpected error occurred", error: err.message });
    }
  }
};

// exports.activate = async (req, res) => {
//   const { tenant_id, tenant_name } = req.query;

//   try {
//     const connection = await db.getConnection();
//     await connection.beginTransaction();
//     try {
//       console.log("Activating user...");

//       // Update the user's status to activated
//       const [updateResult] = await connection.query(
//         "UPDATE nps_users SET status = 1 WHERE id = ? AND tenant_id = ?",
//         [req.query.id, tenant_id]
//       );

//       if (updateResult.affectedRows === 0) {
//         throw new Error("User activation failed. No rows updated.");
//       }

//       // Retrieve the tenant name using tenant_id if tenant_name is not passed
//       let tenantName = tenant_name;
//       if (!tenantName) {
//         const [tenantNameResults] = await connection.query(
//           "SELECT tenant_name FROM nps_tenant WHERE tenant_id = ?",
//           [tenant_id]
//         );

//         if (!tenantNameResults || tenantNameResults.length === 0) {
//           throw new Error("Tenant not found.");
//         }

//         tenantName = tenantNameResults[0].tenant_name;
//       }
//       console.log(`Creating database: nps_${tenantName}`);
//       const tenantDbName = `nps_${tenantName}`;
//       // Create tenant-specific database
//       await connection.query(`CREATE DATABASE IF NOT EXISTS ${tenantDbName}`);
//       await connection.query(`USE ${tenantDbName}`);

//       // Define table creation queries
//       const createTables = [
//         `CREATE TABLE IF NOT EXISTS nps_external_contacts (
//           id INT AUTO_INCREMENT PRIMARY KEY,
//           created_by INT(11) NOT NULL,
//           name VARCHAR(255) NOT NULL,
//           firstname VARCHAR(255) NOT NULL,
//           lastname VARCHAR(255) NOT NULL,
//           contact_details VARCHAR(50),
//           email_id VARCHAR(255) NOT NULL,
//           status INT NOT NULL,
//           created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
//         )`,
//         `CREATE TABLE IF NOT EXISTS nps_segments (
//           segment_id INT AUTO_INCREMENT PRIMARY KEY,
//           segment_name VARCHAR(255) NOT NULL,
//           description TEXT,
//           updated_at DATETIME
//         )`,
//         `CREATE TABLE IF NOT EXISTS nps_tags (
//           tag_id INT AUTO_INCREMENT PRIMARY KEY,
//           tag_name VARCHAR(255) NOT NULL,
//           created_by DATETIME,
//           updated_by DATETIME
//         )`,
//         `CREATE TABLE IF NOT EXISTS nps_segment_tag_map (
//           segment_tag_map_id INT AUTO_INCREMENT PRIMARY KEY,
//           tag_id INT NOT NULL,
//           segment_id INT NOT NULL,
//           FOREIGN KEY (segment_id) REFERENCES nps_segments(segment_id) ON DELETE CASCADE,
//           FOREIGN KEY (tag_id) REFERENCES nps_tags(tag_id) ON DELETE CASCADE
//         )`,
//         `CREATE TABLE IF NOT EXISTS nps_customer_tag_map (
//           tag_map_id INT AUTO_INCREMENT PRIMARY KEY,
//           tag_id INT(11) NOT NULL,
//           customer_id INT(11) NOT NULL
//         )`,
//         `CREATE TABLE IF NOT EXISTS csat_answer (
//           answer_id INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
//           emoji VARCHAR(255) DEFAULT NULL,
//           rating VARCHAR(255) DEFAULT NULL,
//           text VARCHAR(50) NOT NULL,
//           numeric_value VARCHAR(50) NOT NULL,
//           created_by INT(11) NOT NULL,
//           created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
//           updated_by INT(11) NOT NULL,
//           updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
//         ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
//       ];

//       console.log("Creating tables...");
//       for (const query of createTables) {
//         await connection.query(query);
//       }

//       const insertInitialData = `
//         INSERT INTO csat_answer (emoji, rating, text, numeric_value, created_by, updated_by) VALUES
//         ('http://localhost:5000/uploads/sad.png', 'http://localhost:5000/uploads/Star-one.png', 'Very dissatisfied', '1', 1, 1),
//         ('http://localhost:5000/uploads/un_satisfied.png', 'http://localhost:5000/uploads/Star-two.png', 'Dissatisfied', '2', 1, 1),
//         ('http://localhost:5000/uploads/neutral.png', 'http://localhost:5000/uploads/Star-three.png', 'Neutral', '3', 1, 1),
//         ('http://localhost:5000/uploads/satisfied.png', 'http://localhost:5000/uploads/Star-four.png', 'Satisfied', '4', 1, 1),
//         ('http://localhost:5000/uploads/very_satisfied.png', 'http://localhost:5000/uploads/Star-five.png', 'Very Satisfied', '5', 1, 1);
//       `;
//       await connection.query(insertInitialData);

//       await connection.commit();

//       console.log("Activation completed successfully.");
//       return res.status(200).json({
//         message: "Your account has been activated successfully.",
//       });
//     } catch (err) {
//       console.error("Error during activation Tenant database:", err);
//       await connection.rollback();

//       return res.status(500).json({
//         message: "Error during activation Tenant",
//         error: err.message,
//       });
//     }
//   } catch (err) {
//     console.error("Activation error:", err);
//     return res.status(500).json({
//       message: "Activation failed",
//       error: err.message,
//     });
//   }
// };

exports.activate = async (req, res) => {
  const { tenant_id, tenant_name } = req.query;

  try {
    const connection = await db.getConnection();
    await connection.beginTransaction();
    try {
      console.log("Activating user...");

      // Update the user's status to activated
      const [updateResult] = await connection.query(
        "UPDATE nps_users SET status = 1 WHERE id = ? AND tenant_id = ?",
        [req.query.id, tenant_id]
      );

      if (updateResult.affectedRows === 0) {
        throw new Error("User activation failed. No rows updated.");
      }

      // Retrieve the tenant name using tenant_id if tenant_name is not passed
      let tenantName = tenant_name;
      if (!tenantName) {
        const [tenantNameResults] = await connection.query(
          "SELECT tenant_name FROM nps_tenant WHERE tenant_id = ?",
          [tenant_id]
        );

        if (!tenantNameResults || tenantNameResults.length === 0) {
          throw new Error("Tenant not found.");
        }

        tenantName = tenantNameResults[0].tenant_name;
      }
      console.log(`Creating database: nps_${tenantName}`);
      const tenantDbName = `nps_${tenantName}`;
      // Create tenant-specific database
      await connection.query(`CREATE DATABASE IF NOT EXISTS ${tenantDbName}`);
      await connection.query(`USE ${tenantDbName}`);

      // Define table creation queries
      const createTables = [
        `CREATE TABLE IF NOT EXISTS nps_users (
          id INT AUTO_INCREMENT PRIMARY KEY,
          phone_no VARCHAR(20) NOT NULL,
          email VARCHAR(255) NOT NULL UNIQUE,
          password VARCHAR(255) NOT NULL,
          firstname VARCHAR(100) NOT NULL,
          lastname VARCHAR(100) NOT NULL,
          username VARCHAR(100) NOT NULL UNIQUE,
          tenant_id INT NOT NULL,
          status TINYINT(1) DEFAULT 0
        )`,
        `CREATE TABLE IF NOT EXISTS nps_external_contacts (
          id INT AUTO_INCREMENT PRIMARY KEY,
          created_by INT(11) NOT NULL,
          name VARCHAR(255) NOT NULL,
          firstname VARCHAR(255) NOT NULL,
          lastname VARCHAR(255) NOT NULL,
          contact_details VARCHAR(50),
          email_id VARCHAR(255) NOT NULL,
          status INT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS nps_segments (
          segment_id INT AUTO_INCREMENT PRIMARY KEY,
          segment_name VARCHAR(255) NOT NULL,
          description TEXT,
          updated_at DATETIME
        )`,
        `CREATE TABLE IF NOT EXISTS nps_tags (
          tag_id INT AUTO_INCREMENT PRIMARY KEY,
          tag_name VARCHAR(255) NOT NULL,
          created_by DATETIME,
          updated_by DATETIME
        )`,
        `CREATE TABLE IF NOT EXISTS nps_segment_tag_map (
          segment_tag_map_id INT AUTO_INCREMENT PRIMARY KEY,
          tag_id INT NOT NULL,
          segment_id INT NOT NULL,
          FOREIGN KEY (segment_id) REFERENCES nps_segments(segment_id) ON DELETE CASCADE,
          FOREIGN KEY (tag_id) REFERENCES nps_tags(tag_id) ON DELETE CASCADE
        )`,
        `CREATE TABLE IF NOT EXISTS nps_customer_tag_map (
          tag_map_id INT AUTO_INCREMENT PRIMARY KEY,
          tag_id INT(11) NOT NULL,
          customer_id INT(11) NOT NULL
        )`,
        `CREATE TABLE IF NOT EXISTS csat_answer (
          answer_id INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
          emoji VARCHAR(255) DEFAULT NULL,
          rating VARCHAR(255) DEFAULT NULL,
          text VARCHAR(50) NOT NULL,
          numeric_value VARCHAR(50) NOT NULL,
          created_by INT(11) NOT NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_by INT(11) NOT NULL,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
      ];

      console.log("Creating tables...");
      for (const query of createTables) {
        await connection.query(query);
      }

      const insertInitialData = `
        INSERT INTO csat_answer (emoji, rating, text, numeric_value, created_by, updated_by) VALUES
        ('http://localhost:5000/uploads/sad.png', 'http://localhost:5000/uploads/Star-one.png', 'Very dissatisfied', '1', 1, 1),
        ('http://localhost:5000/uploads/un_satisfied.png', 'http://localhost:5000/uploads/Star-two.png', 'Dissatisfied', '2', 1, 1),
        ('http://localhost:5000/uploads/neutral.png', 'http://localhost:5000/uploads/Star-three.png', 'Neutral', '3', 1, 1),
        ('http://localhost:5000/uploads/satisfied.png', 'http://localhost:5000/uploads/Star-four.png', 'Satisfied', '4', 1, 1),
        ('http://localhost:5000/uploads/very_satisfied.png', 'http://localhost:5000/uploads/Star-five.png', 'Very Satisfied', '5', 1, 1);
      `;
      await connection.query(insertInitialData);

      await connection.commit();

      console.log("Activation completed successfully.");
      return res.status(200).json({
        message: "Your account has been activated successfully.",
      });
    } catch (err) {
      console.error("Error during activation Tenant database:", err);
      await connection.rollback();

      return res.status(500).json({
        message: "Error during activation Tenant",
        error: err.message,
      });
    }
  } catch (err) {
    console.error("Activation error:", err);
    return res.status(500).json({
      message: "Activation failed",
      error: err.message,
    });
  }
};


