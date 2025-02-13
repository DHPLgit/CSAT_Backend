const express = require("express");
const {
  login,
  refreshToken,
  signup,
  forgotPassword,
  resetPassword,
  activate, 
  validateToken
} = require("../controllers/authController");
const verifyToken = require("../middleware/authMiddleware");
const router = express.Router();
const db = require("../config/db");
const dynamicDb = require("../utils/dynamicDb");
const upload = require("../middleware/upload");
const { verify } = require("jsonwebtoken");
const path = require("path");
const ejs = require("ejs");
const logger = require('../logger');
router.post("/login", login);
router.post("/refresh-token", refreshToken);
router.post("/signup", signup);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/activate', activate);
router.post('/validate-token', validateToken);
router.post('/logout', (req, res) => {
  // Clear the JWT token cookie by setting an expiration date in the past
  res.clearCookie('jwt_token', { httpOnly: true, secure: true, path: '/' }); // Adjust the cookie name and options if necessary

  res.status(200).json({ message: 'Logged out successfully' });
});
/* Create Tag */
router.post("/add_tag", verifyToken, async (req, res) => {
  const { tag_name, tenant_id, user_id } = req.body;

  if (!tag_name || !tenant_id || !user_id) {
    return res.status(400).json({
      message: "Tag Name, Tenant ID, and User ID are required.",
    });
  }

  try {
    const [tenantResult] = await db.query(
      "SELECT tenant_name FROM nps_shared.nps_tenant WHERE tenant_id = ?",
      [tenant_id]
    );

    if (tenantResult.length === 0) {
      return res.status(404).json({ message: "Tenant not found" });
    }

    const tenantDbName = `nps_${tenantResult[0].tenant_name}`;
    console.log("Tenant Database Name:", tenantDbName);

    const [userResult] = await db.query(
      "SELECT id FROM nps_shared.nps_users WHERE id = ?",
      [user_id]
    );

    if (userResult.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const dynamicDB = await dynamicDb(tenantDbName);

    // Check for duplicate tag (case-sensitive)
    const [duplicateTag] = await dynamicDB.query(
      "SELECT tag_name FROM nps_tags WHERE BINARY tag_name = ?",
      [tag_name]
    );

    if (duplicateTag.length > 0) {
      return res.status(400).json({
        message: `Tag name "${tag_name}" already exists.`,
      });
    }

    // Create the tags table if it doesn't exist
    await dynamicDB.query(
      `CREATE TABLE IF NOT EXISTS nps_tags (
        tag_id INT AUTO_INCREMENT PRIMARY KEY,
        tag_name VARCHAR(255) NOT NULL,
        created_by INT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )`
    );

    // Insert the new tag
    const [result] = await dynamicDB.query(
      "INSERT INTO nps_tags (tag_name, created_by) VALUES (?, ?)",
      [tag_name, user_id]
    );

    res.status(200).json({
      message: "Tag created successfully",
      tag_id: result.insertId,
      tag_name,
      user_id,
    });

    await dynamicDB.end();
  } catch (error) {
    console.error("Error:", error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
});


/* Fetch Tag */
router.get("/get_tags", verifyToken, async (req, res) => {
  const { tenant_id, user_id } = req.query;

  if (!tenant_id || !user_id) {
    return res
      .status(400)
      .json({ message: "Tenant ID and User ID are required" });
  }

  try {
    const [tenantResult] = await db
      .query(
        "SELECT tenant_name FROM nps_shared.nps_tenant WHERE tenant_id = ?",
        [tenant_id]
      );

    if (tenantResult.length === 0) {
      return res.status(404).json({ message: "Tenant not found" });
    }
    const tenantDbName = `nps_${tenantResult[0].tenant_name}`;
    const [userResult] = await db
      .query("SELECT id FROM nps_shared.nps_users WHERE id = ?", [user_id]);

    if (userResult.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    const dynamicDB = await dynamicDb(tenantDbName);
    const [tags] = await dynamicDB.query("SELECT * FROM nps_tags");
    if (tags.length === 0) {
      return res.status(404).json({ message: "No tags found" });
    }

    res.status(200).json({
      message: "Tags fetched successfully",
      tags: tags,
      user_id: user_id,
      tenant_id: tenant_id,
    });
    await dynamicDB.end();
  } catch (error) {
    console.error("Error:", error);
    if (error.code === "ER_NO_SUCH_TABLE") {
      return res
        .status(500)
        .json({ message: "The table does not exist in the tenant database." });
    }
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
});

/* Update Tag */
router.put("/update_tag", verifyToken, async (req, res) => {
  const { tag_id, tag_name, tenant_id, user_id } = req.body;

  if (!tag_id || !tag_name || !tenant_id || !user_id) {
    return res
      .status(400)
      .json({ message: "Tag ID, Tag Name, and Tenant ID are required" });
  }

  try {
    const [tenantResult] = await db
      .query(
        "SELECT tenant_name FROM nps_shared.nps_tenant WHERE tenant_id = ?",
        [tenant_id]
      );

    if (tenantResult.length === 0) {
      return res.status(404).json({ message: "Tenant not found" });
    }

    const tenantDbName = `nps_${tenantResult[0].tenant_name}`;
    console.log("Tenant Database Name:", tenantDbName); 
    const [userResult] = await db
      .query("SELECT id FROM nps_shared.nps_users WHERE id = ?", [user_id]);

    if (userResult.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    const dynamicDB = await dynamicDb(tenantDbName);

    const [duplicateTag] = await dynamicDB.query(
      "SELECT tag_name FROM nps_tags WHERE BINARY tag_name = ?",
      [tag_name]
    );

    if (duplicateTag.length > 0) {
      return res.status(400).json({
        message: `Tag name "${tag_name}" already exists.`,
      });
    }
    const [existingTag] = await dynamicDB.query(
      "SELECT tag_id FROM nps_tags WHERE tag_id = ?",
      [tag_id]
    );

    if (existingTag.length === 0) {
      return res.status(404).json({ message: "Tag not found" });
    }
    await dynamicDB.query(
      "UPDATE nps_tags SET tag_name = ?, updated_by = CURRENT_TIMESTAMP WHERE tag_id = ?",
      [tag_name, tag_id]
    );

    res.status(200).json({
      message: "Tag updated successfully",
      tag_id,
      tag_name,
      user_id: user_id,                 
      tenant_id: tenant_id
    });

    await dynamicDB.end();
  } catch (error) {
    console.error("Error:", error);

    if (error.code === "ER_NO_SUCH_TABLE") {
      return res
        .status(500)
        .json({ message: "The table does not exist in the tenant database." });
    }

    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
});

/* Delete tag */
router.delete("/delete_tag", verifyToken, async (req, res) => {
  const { tag_id, tenant_id, user_id } = req.body;

  if (!tag_id || !tenant_id || !user_id) {
    return res
      .status(400)
      .json({ message: "Tag ID and Tenant ID are required" });
  }
  try {
    const [tenantResult] = await db
      .query(
        "SELECT tenant_name FROM nps_shared.nps_tenant WHERE tenant_id = ?",
        [tenant_id]
      );

    if (tenantResult.length === 0) {
      return res.status(404).json({ message: "Tenant not found" });
    }
    const tenantDbName = `nps_${tenantResult[0].tenant_name}`;
    const [userResult] = await db
      .query("SELECT id FROM nps_shared.nps_users WHERE id = ?", [user_id]);

    if (userResult.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    const dynamicDB = await dynamicDb(tenantDbName);

    const [existingTag] = await dynamicDB.query(
      "SELECT tag_id FROM nps_tags WHERE tag_id = ?",
      [tag_id]
    );

    if (existingTag.length === 0) {
      return res.status(404).json({ message: "Tag not found" });
    }
    await dynamicDB.query("DELETE FROM nps_tags WHERE tag_id = ?", [tag_id]);
    res.status(200).json({ message: "Tag deleted successfully", 
      tag_id,
      user_id: user_id,                 
      tenant_id: tenant_id
    });

    await dynamicDB.end();
  } catch (error) {
    console.error("Error:", error);

    if (error.code === "ER_NO_SUCH_TABLE") {
      return res
        .status(500)
        .json({ message: "The table does not exist in the tenant database." });
    }

    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
});

/* Add Segment */
router.post("/add_segment", verifyToken, async (req, res) => {
  const { segment_name, tenant_id, user_id } = req.body;

  if (!segment_name || !tenant_id || !user_id) {
    return res
      .status(400)
      .json({ message: "Segment Name, Tenant ID, and User ID are required" });
  }

  try {
    const [tenantResult] = await db.query(
      "SELECT tenant_name FROM nps_shared.nps_tenant WHERE tenant_id = ?",
      [tenant_id]
    );

    if (tenantResult.length === 0) {
      return res.status(404).json({ message: "Tenant not found" });
    }

    const tenantDbName = `nps_${tenantResult[0].tenant_name}`;
    console.log("Tenant Database Name:", tenantDbName);

    const [userResult] = await db.query(
      "SELECT id FROM nps_shared.nps_users WHERE id = ?",
      [user_id]
    );

    if (userResult.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const dynamicDB = await dynamicDb(tenantDbName);

    // Check for duplicate segment_name (case-sensitive)
    const [duplicateSegment] = await dynamicDB.query(
      "SELECT segment_name FROM nps_segments WHERE BINARY segment_name = ?",
      [segment_name]
    );

    if (duplicateSegment.length > 0) {
      return res.status(400).json({
        message: `Segment name "${segment_name}" already exists.`,
      });
    }

    // Create the segments table if it doesn't exist
    await dynamicDB.query(
      `CREATE TABLE IF NOT EXISTS nps_segments (
        segment_id INT AUTO_INCREMENT PRIMARY KEY,
        segment_name VARCHAR(255) NOT NULL,
        created_by INT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )`
    );

    // Insert the new segment
    const [result] = await dynamicDB.query(
      "INSERT INTO nps_segments (segment_name) VALUES (?)",
      [segment_name, user_id]
    );

    res.status(201).json({
      message: "Segment created successfully",
      segment_id: result.insertId,
      segment_name,
      user_id,
      tenant_id,
    });

    await dynamicDB.end();
  } catch (error) {
    console.error("Error:", error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
});


/* Get Segment */
router.get("/get_segments", verifyToken, async (req, res) => {
  const { tenant_id, user_id } = req.query;
  if (!tenant_id || !user_id) {
    return res
      .status(400)
      .json({ message: "Tenant ID and User ID are required" });
  }

  try {
    const [tenantResult] = await db
      .query(
        "SELECT tenant_name FROM nps_shared.nps_tenant WHERE tenant_id = ?",
        [tenant_id]
      );

    if (tenantResult.length === 0) {
      return res.status(404).json({ message: "Tenant not found" });
    }
    const tenantDbName = `nps_${tenantResult[0].tenant_name}`;
    const [userResult] = await db
      .query("SELECT id FROM nps_shared.nps_users WHERE id = ?", [user_id]);

    if (userResult.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    const dynamicDB = await dynamicDb(tenantDbName);
    const [segmentTagResults] = await dynamicDB.query(`
      SELECT 
        s.segment_id AS segment_id, s.segment_name, GROUP_CONCAT(t.tag_id) AS tag_id, GROUP_CONCAT(t.tag_name) AS tag_name
      FROM 
        nps_segments s
      LEFT JOIN 
        nps_segment_tag_map stm ON s.segment_id = stm.segment_id
      LEFT JOIN 
        nps_tags t ON stm.tag_id = t.tag_id
      GROUP BY 
        s.segment_id
    `);

    if (segmentTagResults.length === 0) {
      return res.status(404).json({ message: "No segments found" });
    }

    const response = segmentTagResults.map((segment) => ({
      segment_id: segment.segment_id,
      segment_name: segment.segment_name,
      tag_id: segment.tag_id,
      tag_name: segment.tag_name,
      user_id: user_id,
      tenant_id: tenant_id,
    }));

    res.status(200).json({
      message: "Segments with tags fetched successfully",
      data: response,
    });

    await dynamicDB.end();
  } catch (error) {
    console.error("Error:", error);

    if (error.code === "ER_NO_SUCH_TABLE") {
      return res
        .status(500)
        .json({ message: "The table does not exist in the tenant database." });
    }

    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
});

/* Update Segment */
router.put("/update_segment", verifyToken, async (req, res) => {
  const { segment_id, segment_name, tenant_id, user_id } = req.body;

  if (!segment_id || !segment_name || !tenant_id || !user_id) {
    return res.status(400).json({
      message: "Segment ID, Segment Name, and Tenant ID are required",
    });
  }

  try {
    const [tenantResult] = await db
      .query(
        "SELECT tenant_name FROM nps_shared.nps_tenant WHERE tenant_id = ?",
        [tenant_id]
      );

    if (tenantResult.length === 0) {
      return res.status(404).json({ message: "Tenant not found" });
    }

    const tenantDbName = `nps_${tenantResult[0].tenant_name}`;
    console.log("Tenant Database Name:", tenantDbName);

    const [userResult] = await db
      .query("SELECT id FROM nps_shared.nps_users WHERE id = ?", [user_id]);

    if (userResult.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    const dynamicDB = await dynamicDb(tenantDbName);

    const [duplicateSegment] = await dynamicDB.query(
      "SELECT segment_name FROM nps_segments WHERE BINARY segment_name = ?",
      [segment_name]
    );

    if (duplicateSegment.length > 0) {
      return res.status(400).json({
        message: `Segment name "${segment_name}" already exists.`,
      });
    }

    const [existingTag] = await dynamicDB.query(
      "SELECT segment_id FROM nps_segments WHERE segment_id = ?",
      [segment_id]
    );

    if (existingTag.length === 0) {
      return res.status(404).json({ message: "Segment not found" });
    }
    await dynamicDB.query(
      "UPDATE nps_segments SET segment_name = ?, updated_at = CURRENT_TIMESTAMP WHERE segment_id = ?",
      [segment_name, segment_id]
    );

    res.status(200).json({
      message: "Segment updated successfully",
      segment_id,
      segment_name,
      user_id: user_id,                 
      tenant_id: tenant_id
    });
    await dynamicDB.end();
  } catch (error) {
    console.error("Error:", error);

    if (error.code === "ER_NO_SUCH_TABLE") {
      return res
        .status(500)
        .json({ message: "The table does not exist in the tenant database." });
    }

    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
});

/* Delete Segment */
router.delete("/delete_segment", verifyToken, async (req, res) => {
  const { segment_id, tenant_id, user_id } = req.body;

  if (!segment_id || !tenant_id || !user_id) {
    return res
      .status(400)
      .json({ message: "Segment ID and Tenant ID are required" });
  }

  try {
    const [tenantResult] = await db
      .query(
        "SELECT tenant_name FROM nps_shared.nps_tenant WHERE tenant_id = ?",
        [tenant_id]
      );

    if (tenantResult.length === 0) {
      return res.status(404).json({ message: "Tenant not found" });
    }

    const tenantDbName = `nps_${tenantResult[0].tenant_name}`;
    const dynamicDB = await dynamicDb(tenantDbName);

    const [existingTag] = await dynamicDB.query(
      "SELECT segment_id FROM nps_segments WHERE segment_id = ?",
      [segment_id]
    );

    if (existingTag.length === 0) {
      return res.status(404).json({ message: "Segment not found" });
    }

    await dynamicDB.query("DELETE FROM nps_segments WHERE segment_id = ?", [
      segment_id,
    ]);

    res
      .status(200)
      .json({ message: "Segment deleted successfully", 
        segment_id,
        user_id: user_id,                 
        tenant_id: tenant_id
       });

    await dynamicDB.end();
  } catch (error) {
    console.error("Error:", error);

    if (error.code === "ER_NO_SUCH_TABLE") {
      return res
        .status(500)
        .json({ message: "The table does not exist in the tenant database." });
    }

    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
});

/* Add Contact */
router.post("/add_contact", verifyToken, async (req, res) => {
  const { user_id, tenant_id, firstname, lastname, contact_details, email_id } = req.body;

  if (!user_id || !tenant_id || !firstname || !lastname || !contact_details || !email_id) {
    return res.status(400).json({
      message:
        "All fields (tenant_id, firstname, lastname, contact_details, email_id) are required.",
    });
  }

  try {
    // Fetch tenant name
    const [tenantResult] = await db.query(
      "SELECT tenant_name FROM nps_shared.nps_tenant WHERE tenant_id = ?",
      [tenant_id]
    );

    if (tenantResult.length === 0) {
      return res.status(404).json({ message: "Tenant not found." });
    }

    const tenantDbName = `nps_${tenantResult[0].tenant_name}`;
    console.log("Tenant Database Name:", tenantDbName);

    // Validate user
    const [userResult] = await db.query(
      "SELECT id FROM nps_shared.nps_users WHERE id = ?",
      [user_id]
    );

    if (userResult.length === 0) {
      return res.status(404).json({ message: "User not found." });
    }

    // Establish tenant-specific DB connection
    const dynamicDB = await dynamicDb(tenantDbName);

    // Create the table if not exists
    await dynamicDB.query(
      `CREATE TABLE IF NOT EXISTS nps_external_contacts (
          id INT AUTO_INCREMENT PRIMARY KEY,
          firstname VARCHAR(255) NOT NULL,
          lastname VARCHAR(255) NOT NULL,
          name VARCHAR(255) NOT NULL,
          contact_details TEXT NOT NULL,
          email_id VARCHAR(255) NOT NULL,
          status TINYINT(1) NOT NULL DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )`
    );

    // Check for existing email_id
    const [emailExists] = await dynamicDB.query(
      `SELECT id, status FROM nps_external_contacts WHERE email_id = ?`,
      [email_id]
    );

    if (emailExists.length > 0) {
      const emailContact = emailExists[0];
      if (emailContact.status === 0) {
        await dynamicDB.query(
          `UPDATE nps_external_contacts 
           SET status = 1 
           WHERE id = ?`,
          [emailContact.id]
        );

        return res.status(200).json({
          message: "Contact added successfully",
          id: emailContact.id,
          firstname,
          lastname,
          name: `${firstname} ${lastname}`,
          contact_details,
          email_id,
          status: 1,
          user_id,
          tenant_id,
        });
      }

      return res.status(409).json({
        message: "The Email already exists.",
      });
    }

    // Check for existing contact_details
    const [phoneExists] = await dynamicDB.query(
      `SELECT id, status FROM nps_external_contacts WHERE contact_details = ?`,
      [contact_details]
    );

    if (phoneExists.length > 0) {
      const phoneContact = phoneExists[0];
      if (phoneContact.status === 0) {
        await dynamicDB.query(
          `UPDATE nps_external_contacts 
           SET status = 1 
           WHERE id = ?`,
          [phoneContact.id]
        );

        return res.status(200).json({
          message: "Contact added successfully",
          id: phoneContact.id,
          firstname,
          lastname,
          name: `${firstname} ${lastname}`,
          contact_details,
          email_id,
          status: 1,
          user_id,
          tenant_id,
        });
      }

      return res.status(409).json({
        message: "The Contact number already exists.",
      });
    }

    const fullName = `${firstname} ${lastname}`;

    // Add new contact
    const [result] = await dynamicDB.query(
      `INSERT INTO nps_external_contacts (firstname, lastname, name, contact_details, email_id, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [firstname, lastname, fullName, contact_details, email_id, 1]
    );

    res.status(201).json({
      message: "Contact added successfully",
      id: result.insertId,
      firstname,
      lastname,
      name: fullName,
      contact_details,
      email_id,
      status: 1,
      user_id,
      tenant_id,
    });

    await dynamicDB.end();
  } catch (error) {
    console.error("Error:", error);
    if (error.code === "ER_NO_SUCH_TABLE") {
      return res.status(500).json({
        message: "The table does not exist in the tenant database.",
      });
    }
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
});

/* Get Contacts */
router.get("/get_contacts", verifyToken, async (req, res) => {
  const { tenant_id, user_id } = req.query;
  if (!tenant_id || !user_id) {
    return res
      .status(400)
      .json({ message: "Tenant ID and User ID are required" });
  }
  try {
    const [tenantResult] = await db
      .query(
        "SELECT tenant_name FROM nps_shared.nps_tenant WHERE tenant_id = ?",
        [tenant_id]
      );
    if (tenantResult.length === 0) {
      return res.status(404).json({ message: "Tenant not found" });
    }
    const tenantDbName = `nps_${tenantResult[0].tenant_name}`;
    const [userResult] = await db
      .query("SELECT id FROM nps_shared.nps_users WHERE id = ?", [user_id]);
    if (userResult.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    const dynamicDB = await dynamicDb(tenantDbName);
    const [contactTagResults] = await dynamicDB.query(`
      SELECT 
        ec.id AS contact_id, 
        ec.firstname, 
        ec.lastname, 
        ec.email_id, 
        ec.contact_details, 
        ec.status, 
        GROUP_CONCAT(ctm.tag_id) AS tag_ids, 
        GROUP_CONCAT(nt.tag_name) AS tag_names
      FROM 
        nps_external_contacts ec
      LEFT JOIN 
        nps_customer_tag_map ctm ON ec.id = ctm.customer_id
      LEFT JOIN 
        nps_tags nt ON ctm.tag_id = nt.tag_id
      WHERE 
        ec.status = 1
      GROUP BY 
        ec.id
    `);
    if (contactTagResults.length === 0) {
      return res.status(404).json({ message: "No active contacts found" });
    }
    const response = contactTagResults.map((contact) => ({
      id: contact.contact_id,
      firstname: contact.firstname,
      lastname: contact.lastname,
      email_id: contact.email_id,
      contact_details: contact.contact_details,
      tag_ids: contact.tag_ids || null,
      tag_names: contact.tag_names || null,
      status: contact.status, 
      user_id: user_id,
      tenant_id: tenant_id,
    }));
    res.status(200).json({
      message: "Active contacts with tags fetched successfully",
      data: response,
    });
    await dynamicDB.end();
  } catch (error) {
    console.error("Error:", error);
    if (error.code === "ER_NO_SUCH_TABLE") {
      return res
        .status(500)
        .json({ message: "The table does not exist in the tenant database." });
    }
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }

});
/* Update Contact */
router.put("/update_contact", verifyToken, async (req, res) => {
  const {
    tenant_id,
    id,
    firstname,
    lastname,
    contact_details,
    email_id,
    user_id,
  } = req.body;

  if (!tenant_id || !id || !user_id) {
    return res.status(400).json({
      message:
        "Both tenant_id, contact ID, and user_id are required for updating contact details.",
    });
  }

  try {
    const [tenantResult] = await db
      .query(
        "SELECT tenant_name FROM nps_shared.nps_tenant WHERE tenant_id = ?",
        [tenant_id]
      );

    if (tenantResult.length === 0) {
      return res.status(404).json({ message: "Tenant not found." });
    }

    const tenantDbName = `nps_${tenantResult[0].tenant_name}`;
    console.log("Tenant Database Name:", tenantDbName);

    const [userResult] = await db
      .query("SELECT id FROM nps_shared.nps_users WHERE id = ?", [user_id]);

    if (userResult.length === 0) {
      return res.status(404).json({ message: "User not found." });
    }

    const dynamicDB = await dynamicDb(tenantDbName);

    await dynamicDB.query(
      `CREATE TABLE IF NOT EXISTS nps_external_contacts (
          id INT AUTO_INCREMENT PRIMARY KEY,
          firstname VARCHAR(255) NOT NULL,
          lastname VARCHAR(255) NOT NULL,
          contact_details TEXT NOT NULL,
          email_id VARCHAR(255) NOT NULL,
          status TINYINT(1) NOT NULL DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )`
    );

    const [existingEmail] = await dynamicDB.query(
      `SELECT id FROM nps_external_contacts WHERE email_id = ? AND id != ?`,
      [email_id, id]
    );

    if (existingEmail.length > 0) {
      return res.status(409).json({
        message: "The email_id already exists in the database. Please use a different email.",
      });
    }

    const [existingContactDetails] = await dynamicDB.query(
      `SELECT id FROM nps_external_contacts WHERE contact_details = ? AND id != ?`,
      [contact_details, id]
    );

    if (existingContactDetails.length > 0) {
      return res.status(409).json({
        message: "The contact_details already exists in the database. Please use a different contact.",
      });
    }

    const [result] = await dynamicDB.query(
      `UPDATE nps_external_contacts
       SET firstname = COALESCE(?, firstname),
           lastname = COALESCE(?, lastname),
           contact_details = COALESCE(?, contact_details),
           email_id = COALESCE(?, email_id)
       WHERE id = ?`,
      [firstname, lastname, contact_details, email_id, id]
    );

    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ message: "Contact not found or no changes made." });
    }

    res.status(200).json({
      message: "Contact updated successfully.",
      id,
      firstname,
      lastname,
      contact_details,
      email_id,
      status: 1, // Ensure status remains as 1
      user_id,
      tenant_id,
    });

    await dynamicDB.end();
  } catch (error) {
    console.error("Error:", error);

    if (error.code === "ER_NO_SUCH_TABLE") {
      return res.status(500).json({
        message: "The table does not exist in the tenant database.",
      });
    }

    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
});

/* Delete Contact */
router.delete("/delete_contact", verifyToken, async (req, res) => {
  const { id, tenant_id, user_id } = req.body;

  if (!id || !tenant_id || !user_id) {
    return res
      .status(400)
      .json({ message: "Contact ID, Tenant ID, and User ID are required." });
  }

  try {
    const [tenantResult] = await db
      .query(
        "SELECT tenant_name FROM nps_shared.nps_tenant WHERE tenant_id = ?",
        [tenant_id]
      );

    if (tenantResult.length === 0) {
      return res.status(404).json({ message: "Tenant not found." });
    }

    const tenantDbName = `nps_${tenantResult[0].tenant_name}`;

    const [userResult] = await db
      .query("SELECT id FROM nps_shared.nps_users WHERE id = ?", [user_id]);

    if (userResult.length === 0) {
      return res.status(404).json({ message: "User not found." });
    }

    const dynamicDB = await dynamicDb(tenantDbName);

    const [existingContact] = await dynamicDB.query(
      "SELECT id FROM nps_external_contacts WHERE id = ?",
      [id]
    );

    if (existingContact.length === 0) {
      return res.status(404).json({ message: "Contact not found." });
    }

    // Perform soft delete by setting the status to 0
    await dynamicDB.query("UPDATE nps_external_contacts SET status = 0 WHERE id = ?", [
      id,
    ]);

    res.status(200).json({ 
      message: "Contact soft-deleted successfully.",
      contact_id: id,
      user_id: user_id,
      tenant_id: tenant_id 
    });

    await dynamicDB.end();
  } catch (error) {
    console.error("Error:", error);

    if (error.code === "ER_NO_SUCH_TABLE") {
      return res
        .status(500)
        .json({ message: "The table does not exist in the tenant database." });
    }

    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
});

router.put("/update_segment_tag", verifyToken, async (req, res) => {
  const { tenant_id, user_id, segment_id, tag_id } = req.body;

  if (!tenant_id || !user_id || !segment_id) {
    return res.status(400).json({
      message: "Tenant ID, User ID, and Segment ID are required",
    });
  }

  try {
    const [tenantResult] = await db
      .query(
        "SELECT tenant_name FROM nps_shared.nps_tenant WHERE tenant_id = ?",
        [tenant_id]
      );

    if (tenantResult.length === 0) {
      return res.status(404).json({ message: "Tenant not found" });
    }

    const tenantDbName = `nps_${tenantResult[0].tenant_name}`;

    const [userResult] = await db
      .query("SELECT id FROM nps_shared.nps_users WHERE id = ?", [user_id]);

    if (userResult.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const dynamicDB = await dynamicDb(tenantDbName);

    const [segmentExists] = await dynamicDB.query(
      "SELECT segment_id FROM nps_segments WHERE segment_id = ?",
      [segment_id]
    );

    if (segmentExists.length === 0) {
      return res.status(404).json({ message: "Segment not found" });
    }

    await dynamicDB.query("DELETE FROM nps_segment_tag_map WHERE segment_id = ?", [
      segment_id,
    ]);

    if (tag_id && tag_id.trim() !== "") {
      const tagIdArray = tag_id.split(",").map((id) => [segment_id, parseInt(id.trim())]);
      await dynamicDB.query(
        "INSERT INTO nps_segment_tag_map (segment_id, tag_id) VALUES ?",
        [tagIdArray]
      );
    }

    res.status(200).json({
      message: "Segment tags updated successfully",
      segment_id: segment_id,
      tag_id: tag_id || null,
      user_id: user_id,
      tenant_id: tenant_id,
    });

    await dynamicDB.end();
  } catch (error) {
    console.error("Error:", error);
    if (error.code === "ER_NO_SUCH_TABLE") {
      return res.status(500).json({
        message: "The table does not exist in the tenant database.",
      });
    }
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
});

// Update Contact Tag
router.put("/update_contact_tag", verifyToken, async (req, res) => {
  const { tenant_id, user_id, contact_id, tag_id } = req.body;

  if (!tenant_id || !user_id || !contact_id) {
    return res.status(400).json({
      message: "Tenant ID, User ID, and Contact ID are required",
    });
  }

  try {
    const [tenantResult] = await db
      .query(
        "SELECT tenant_name FROM nps_shared.nps_tenant WHERE tenant_id = ?",
        [tenant_id]
      );
    if (tenantResult.length === 0) {
      return res.status(404).json({ message: "Tenant not found" });
    }
    const tenantDbName = `nps_${tenantResult[0].tenant_name}`;

    const [userResult] = await db
      .query("SELECT id FROM nps_shared.nps_users WHERE id = ?", [user_id]);
    if (userResult.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    const dynamicDB = await dynamicDb(tenantDbName);
    const [contactExists] = await dynamicDB.query(
      "SELECT id FROM nps_external_contacts WHERE id = ?",
      [contact_id]
    );
    if (contactExists.length === 0) {
      return res.status(404).json({ message: "Contact not found" });
    }

    await dynamicDB.query("DELETE FROM nps_customer_tag_map WHERE customer_id = ?", [
      contact_id,
    ]);

    if (tag_id && tag_id.trim() !== "") {
      const tagIdArray = tag_id.split(",").map((id) => [contact_id, parseInt(id.trim())]);
      await dynamicDB.query(
        "INSERT INTO nps_customer_tag_map (customer_id, tag_id) VALUES ?",
        [tagIdArray]
      );
    }

    res.status(200).json({
      message: "Contact tags updated successfully",
      id: contact_id,
      tag_id: tag_id || null, 
      user_id: user_id,
      tenant_id: tenant_id,
    });

    await dynamicDB.end();
  } catch (error) {
    console.error("Error:", error);
    if (error.code === "ER_NO_SUCH_TABLE") {
      return res.status(500).json({
        message: "The table does not exist in the tenant database.",
      });
    }
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
});

// Get All Answers
router.get("/get_all_answers", verifyToken, async (req, res) => {
  const { tenant_id, user_id } = req.query;
  if (!tenant_id || !user_id) {
    return res
      .status(400)
      .json({ message: "Tenant ID and User ID are required" });
  }

  try {
    const [tenantResult] = await db
      .query(
        "SELECT tenant_name FROM nps_shared.nps_tenant WHERE tenant_id = ?",
        [tenant_id]
      );

    if (tenantResult.length === 0) {
      return res.status(404).json({ message: "Tenant not found" });
    }
    const tenantDbName = `nps_${tenantResult[0].tenant_name}`;
    const dynamicDB = await dynamicDb(tenantDbName);
    try {
      const [answers] = await dynamicDB.query(
        "SELECT answer_id, text, emoji, rating, numeric_value, created_by FROM csat_answer"
      );

      if (answers.length === 0) {
        return res.status(404).json({ message: "No answers found" });
      }
      const result = answers.map((answer) => {
        const emojiUrl = `${answer.emoji.replace(/\\/g, "/")}`;
        const ratingUrl = `${answer.rating.replace(/\\/g, "/")}`;

        return {
          answer_id: answer.answer_id,
          text: answer.text,
          emoji: emojiUrl,
          rating: ratingUrl,
          numeric_value: answer.numeric_value,
          created_by: answer.created_by
        };
      });

      res.status(200).json({
        message: "Answers fetched successfully",
        answers: result,
      });
    } finally {
      await dynamicDB.end();
    }
  } catch (error) {
    console.error("Error:", error);
    if (error.code === "ER_NO_SUCH_TABLE") {
      return res.status(500).json({
        message: "The table does not exist in the tenant database.",
      });
    }

    res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
});

//Get answer by id
router.get("/get_answer", verifyToken, async (req, res) => {
  const { tenant_id, user_id, answer_id } = req.query;

  if (!tenant_id || !user_id || !answer_id) {
    return res
      .status(400)
      .json({ message: "Tenant ID, User ID, and Answer ID are required" });
  }

  try {
    const [tenantResult] = await db
      .query(
        "SELECT tenant_name FROM nps_shared.nps_tenant WHERE tenant_id = ?",
        [tenant_id]
      );

    if (tenantResult.length === 0) {
      return res.status(404).json({ message: "Tenant not found" });
    }
    const tenantDbName = `nps_${tenantResult[0].tenant_name}`;
    const [userResult] = await db
      .query("SELECT id FROM nps_shared.nps_users WHERE id = ?", [user_id]);

    if (userResult.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    const dynamicDB = await dynamicDb(tenantDbName);
    const [answerDetails] = await dynamicDB.query(
      "SELECT answer_id, text, emoji, created_by FROM csat_answer WHERE answer_id = ?",
      [answer_id]
    );

    if (answerDetails.length === 0) {
      return res.status(404).json({ message: "Answer not found" });
    }

    const answer = answerDetails[0];
    const emojiPath = answer.emoji.replace(/\\/g, '/');
    const fullEmojiPath = `${req.protocol}://${req.get("host")}/${emojiPath}`;
    res.status(200).json({
      message: "Answer details fetched successfully",
      answer: {
        answer_id: answer.answer_id,
        text: answer.text,
        emoji: fullEmojiPath,
        created_by: answer.created_by
      },
    });

    await dynamicDB.end();
  } catch (error) {
    console.error("Error:", error);
    if (error.code === "ER_NO_SUCH_TABLE") {
      return res
        .status(500)
        .json({ message: "The table does not exist in the tenant database." });
    }

    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
});

// Update Answers
router.put("/update_answer", verifyToken, upload.single("image"), async (req, res) => {
  const { tenant_id, user_id, answer_id, text } = req.body;

  if (!tenant_id || !user_id || !answer_id || !text) {
    return res.status(400).json({
      message: "Tenant ID, User ID, Answer ID, and Text are required",
    });
  }

  try {
    const [tenantResult] = await db
      .query(
        "SELECT tenant_name FROM nps_shared.nps_tenant WHERE tenant_id = ?",
        [tenant_id]
      );

    if (tenantResult.length === 0) {
      return res.status(404).json({ message: "Tenant not found" });
    }

    const tenantDbName = `nps_${tenantResult[0].tenant_name}`;

    const [userResult] = await db
      .query("SELECT id FROM nps_shared.nps_users WHERE id = ?", [user_id]);

    if (userResult.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const dynamicDB = await dynamicDb(tenantDbName);

    try {
      const [answerResult] = await dynamicDB.query(
        "SELECT answer_id, emoji FROM csat_answer WHERE answer_id = ?",
        [answer_id]
      );

      if (answerResult.length === 0) {
        return res.status(404).json({ message: "Answer not found" });
      }

      let emojiPath;
      if (req.file) {
        const fileName = req.file.filename; 
        emojiPath = `http://localhost:5000/uploads/${fileName}`; 
      } else {
        emojiPath = answerResult[0].emoji; 
      }

      const query = "UPDATE csat_answer SET text = ?, emoji = ? WHERE answer_id = ?";
      const params = [text, emojiPath, answer_id];
      await dynamicDB.query(query, params);

      const correctedEmojiPath = `${emojiPath.replace(/\\/g, "/")}`;

      res.status(200).json({
        message: "Answer updated successfully",
        answer_id,
        text,
        emoji: correctedEmojiPath,
      });
    } finally {
      await dynamicDB.end();
    }
  } catch (error) {
    console.error("Error:", error);

    if (error.code === "ER_NO_SUCH_TABLE") {
      return res.status(500).json({
        message: "The table does not exist in the tenant database.",
      });
    }

    res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
});


//Add answer
router.post("/add_answer", verifyToken, upload.single("image"), async (req, res) => {
    const { tenant_id, user_id, text } = req.body;

    if (!tenant_id || !user_id || !text) {
      return res
        .status(400)
        .json({ message: "Tenant ID, User ID, and Text are required" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "Image is required" });
    }

    try {
      const [tenantResult] = await db
        .query(
          "SELECT tenant_name FROM nps_shared.nps_tenant WHERE tenant_id = ?",
          [tenant_id]
        );

      if (tenantResult.length === 0) {
        return res.status(404).json({ message: "Tenant not found" });
      }

      const tenantDbName = `nps_${tenantResult[0].tenant_name}`;
      const [userResult] = await db
        .query("SELECT id FROM nps_shared.nps_users WHERE id = ?", [user_id]);

      if (userResult.length === 0) {
        return res.status(404).json({ message: "User not found" });
      }

      const dynamicDB = await dynamicDb(tenantDbName);

      const [result] = await dynamicDB.query(
        "INSERT INTO csat_answer (text, emoji, created_by) VALUES (?, ?, ?)",
        [text, req.file.path, user_id]
      );

      const fullImagePath = `${req.protocol}://${req.get("host")}/${req.file.path}`;
      res.status(201).json({
        message: "Answer added successfully",
        answer_id: result.insertId,
        text,
        emoji: fullImagePath, 
        created_by: user_id
      });

      await dynamicDB.end();
    } catch (error) {
      console.error("Error:", error);

      if (error.code === "ER_NO_SUCH_TABLE") {
        return res
          .status(500)
          .json({ message: "The table does not exist in the tenant database." });
      }

      res
        .status(500)
        .json({ message: "Internal server error", error: error.message });
    }
  }
);

// Get All Survey
router.get("/get_all_survey", verifyToken, async (req, res) => {
  const { tenant_id, user_id } = req.query; 
  if (!tenant_id || !user_id) {
    return res.status(400).json({ message: "Tenant ID and User ID are required" });
  }
  try {
    const [tenantResult] = await db.query(
      "SELECT tenant_name FROM nps_shared.nps_tenant WHERE tenant_id = ?",
      [tenant_id]
    );

    if (tenantResult.length === 0) {
      return res.status(404).json({ message: "Tenant not found" });
    }
    const tenantDbName = `nps_${tenantResult[0].tenant_name}`;
    const [userResult] = await db.query(
      "SELECT id FROM nps_shared.nps_users WHERE id = ?",
      [user_id]
    );

    if (userResult.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const dynamicDB = await dynamicDb(tenantDbName);
    const [surveyDetails] = await dynamicDB.query(
      `SELECT 
         survey_id, survey_name, answer_list, survey_question, sent_status, status, created_by,
         DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
         updated_by,
         DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
       FROM csat_survey_detail 
       WHERE status = '1'`
    );

    if (surveyDetails.length === 0) {
      return res.status(200).json({ message: "No survey details found with status 1" });
    }

    res.status(200).json({
      message: "Survey details fetched successfully",
      survey_details: surveyDetails,
    });
    
    await dynamicDB.end();
  } catch (error) {
    console.error("Error:", error);

    if (error.code === "ER_NO_SUCH_TABLE") {
      return res
        .status(200)
        .json({ message: "The table does not exist in the tenant database." });
    }
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
});

// Get Survey By Id
router.get("/get_survey", verifyToken, async (req, res) => {
  const { tenant_id, user_id, survey_id } = req.query;
  if (!tenant_id || !user_id || !survey_id) {
    return res.status(400).json({ message: "Tenant ID, User ID, and Survey ID are required" });
  }

  try {
    const [tenantResult] = await db.query(
      "SELECT tenant_name FROM nps_shared.nps_tenant WHERE tenant_id = ?",
      [tenant_id]
    );

    if (tenantResult.length === 0) {
      return res.status(404).json({ message: "Tenant not found" });
    }
    const tenantDbName = `nps_${tenantResult[0].tenant_name}`;
    const [userResult] = await db.query(
      "SELECT id FROM nps_shared.nps_users WHERE id = ?",
      [user_id]
    );

    if (userResult.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    const dynamicDB = await dynamicDb(tenantDbName);
    const [surveyDetails] = await dynamicDB.query(
      "SELECT * FROM csat_survey_detail WHERE survey_id = ?",
      [survey_id]
    );

    if (surveyDetails.length === 0) {
      return res.status(404).json({ message: "Survey not found" });
    }

    res.status(200).json({
      message: "Survey details fetched successfully",
      survey_details: surveyDetails[0]
    });
    await dynamicDB.end();
  } catch (error) {
    console.error("Error:", error);

    if (error.code === "ER_NO_SUCH_TABLE") {
      return res
        .status(500)
        .json({ message: "The table does not exist in the tenant database." });
    }
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
});

// Add Survey
router.post("/add_survey", verifyToken, async (req, res) => {
  const { survey_name, answer_list, survey_question, tenant_id, user_id } = req.body;

  if (!survey_name || !answer_list || !tenant_id || !user_id) {
    return res.status(400).json({
      message: "Survey Name, Answer List, Tenant ID, and User ID are required.",
    });
  }

  try {
    // Ensure the tenant exists in the main database
    const [tenantResult] = await db.query(
      "SELECT tenant_name FROM nps_shared.nps_tenant WHERE tenant_id = ?",
      [tenant_id]
    );

    if (tenantResult.length === 0) {
      return res.status(404).json({ message: "Tenant not found" });
    }

    const tenantDbName = `nps_${tenantResult[0].tenant_name}`;
    console.log("Tenant Database Name:", tenantDbName);

    // Ensure the user exists in the main database
    const [userResult] = await db.query(
      "SELECT id FROM nps_shared.nps_users WHERE id = ?",
      [user_id]
    );

    if (userResult.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const dynamicDB = await dynamicDb(tenantDbName);
    await dynamicDB.query(`
      CREATE TABLE IF NOT EXISTS csat_survey_detail (
        survey_id INT AUTO_INCREMENT PRIMARY KEY,
        survey_name VARCHAR(100) NOT NULL,
        answer_list ENUM('1','2','3','4') NOT NULL,
        survey_question VARCHAR(255) NOT NULL,
        sent_status ENUM('0','1') DEFAULT NULL,
        status ENUM('0','1') NOT NULL DEFAULT '1',
        created_by INT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_by INT NOT NULL,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    `);

    // Insert the new survey details into the tenant-specific database with sent_status set to NULL
    const [result] = await dynamicDB.query(
      "INSERT INTO csat_survey_detail (survey_name, answer_list, survey_question, sent_status, created_by) VALUES (?, ?, ?, NULL, ?)",
      [survey_name, answer_list, survey_question, user_id]
    );

    res.status(200).json({
      message: "Survey created successfully",
      survey_id: result.insertId,
      survey_name,
      answer_list,
      survey_question,
      sent_status: null, // Explicitly mention sent_status as null
      created_by: user_id,
    });

    // Close the connection to the tenant-specific DB
    await dynamicDB.end();
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
});


// Update Survey
router.put("/update_survey", verifyToken, async (req, res) => {
  const {survey_id, survey_name, answer_list, survey_question, tenant_id,user_id} = req.body;

  if (!survey_id || !tenant_id || !user_id || !survey_name || !answer_list || !survey_question) {
    return res.status(400).json({
      message: "Survey ID, Tenant ID, and User ID are required.",
    });
  }
  try {
    const [tenantResult] = await db
      .query(
        "SELECT tenant_name FROM nps_shared.nps_tenant WHERE tenant_id = ?",
        [tenant_id]
      );

    if (tenantResult.length === 0) {
      return res.status(404).json({ message: "Tenant not found" });
    }
    const tenantDbName = `nps_${tenantResult[0].tenant_name}`;
    console.log("Tenant Database Name:", tenantDbName);
    const [userResult] = await db
      .query("SELECT id FROM nps_shared.nps_users WHERE id = ?", [user_id]);
    if (userResult.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    const dynamicDB = await dynamicDb(tenantDbName);
    const [result] = await dynamicDB.query(
      `UPDATE csat_survey_detail 
       SET survey_name = ?, answer_list = ?, survey_question = ?, updated_by = ? WHERE survey_id = ?`,
      [survey_name, answer_list, survey_question, user_id, survey_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Survey not found or no changes made." });
    }
    res.status(200).json({
      message: "Survey updated successfully",
      survey_id,
      survey_name,
      answer_list,
      survey_question
    });

    await dynamicDB.end();
  } catch (error) {
    console.error("Error:", error);

    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
});

// Delete Survey
router.delete("/delete_survey", verifyToken, async (req, res) => {
  const { survey_id} = req.query;
  const {tenant_id, user_id } = req.body;

  if (!survey_id || !tenant_id || !user_id) {
    return res.status(400).json({
      message: "Survey ID, Tenant ID, and User ID are required.",
    });
  }

  try {
    const [tenantResult] = await db
      .query(
        "SELECT tenant_name FROM nps_shared.nps_tenant WHERE tenant_id = ?",
        [tenant_id]
      );

    if (tenantResult.length === 0) {
      return res.status(404).json({ message: "Tenant not found" });
    }
    const tenantDbName = `nps_${tenantResult[0].tenant_name}`;
    const [userResult] = await db
      .query("SELECT id FROM nps_shared.nps_users WHERE id = ?", [user_id]);

    if (userResult.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    const dynamicDB = await dynamicDb(tenantDbName);
    const [surveyResult] = await dynamicDB.query(
      "SELECT status FROM csat_survey_detail WHERE survey_id = ?",
      [survey_id]
    );

    if (surveyResult.length === 0) {
      return res.status(404).json({ message: "Survey not found" });
    }

    const currentStatus = surveyResult[0].status;
    const newStatus = currentStatus === "1" ? "0" : "1";
    await dynamicDB.query(
      "UPDATE csat_survey_detail SET status = ?, updated_by = ? WHERE survey_id = ?",
      [newStatus, user_id, survey_id]
    );

    res.status(200).json({
      message: `Survey ${newStatus === "0" ? "deleted" : "restored"} successfully`,
      survey_id,
      new_status: newStatus,
    });
    await dynamicDB.end();
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
});

// Sent Survey
router.get("/sent_survey", verifyToken, async (req, res) => {
  const { tenant_id, user_id } = req.query;
  if (!tenant_id || !user_id) {
    return res
      .status(400)
      .json({ message: "Tenant ID and User ID are required" });
  }

  try {
    const [tenantResult] = await db.query(
      "SELECT tenant_name FROM nps_shared.nps_tenant WHERE tenant_id = ?",
      [tenant_id]
    );

    if (tenantResult.length === 0) {
      return res.status(404).json({ message: "Tenant not found" });
    }

    const tenantDbName = `nps_${tenantResult[0].tenant_name}`;

    const [userResult] = await db.query(
      "SELECT id FROM nps_shared.nps_users WHERE id = ?",
      [user_id]
    );

    if (userResult.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const dynamicDB = await dynamicDb(tenantDbName);

    const [survey] = await dynamicDB.query(
      `SELECT survey_id, survey_name, sent_status, status 
       FROM csat_survey_detail 
       WHERE sent_status IN ('0', '1') AND status = '1'`
    );

    if (survey.length === 0) {
      return res.status(200).json({
        message: "No surveys found",
      });
    }

    res.status(200).json({
      message: "Survey details fetched successfully",
      user_id,
      tenant_id,
      surveys: survey
    });

    await dynamicDB.end();
  } catch (error) {
    console.error("Error:", error);

    if (error.code === "ER_NO_SUCH_TABLE") {
      return res.status(200).json({
        message: "The table does not exist in the tenant database.",
      });
    }

    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
});

// Get Sent survey by Id
router.get("/get_surveyById", verifyToken, async (req, res) => {
  const { tenant_id, user_id, survey_id } = req.query;

  if (!tenant_id || !user_id || !survey_id) {
    return res
      .status(400)
      .json({ message: "Tenant ID, User ID, and Survey ID are required" });
  }

  try {
    const [tenantResult] = await db
      .query(
        "SELECT tenant_name FROM nps_shared.nps_tenant WHERE tenant_id = ?",
        [tenant_id]
      );

    if (tenantResult.length === 0) {
      return res.status(404).json({ message: "Tenant not found" });
    }
    const tenantDbName = `nps_${tenantResult[0].tenant_name}`;
    const [userResult] = await db
      .query("SELECT id FROM nps_shared.nps_users WHERE id = ?", [user_id]);

    if (userResult.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    const dynamicDB = await dynamicDb(tenantDbName);
    const [surveyResult] = await dynamicDB.query(
      "SELECT survey_name FROM csat_survey_detail WHERE survey_id = ?",
      [survey_id]
    );

    if (surveyResult.length === 0) {
      return res.status(404).json({ message: "Survey not found" });
    }
    const surveyName = surveyResult[0].survey_name;

    const [responseDetails] = await dynamicDB.query(
      `SELECT 
        nec.firstname, nec.contact_details, nec.email_id, csr.answer AS 'satisfaction_level', csr.location, csr.created_at 
        FROM csat_survey_response csr
        JOIN nps_external_contacts nec ON csr.customer_id = nec.id
        WHERE csr.survey_id = ?`,
      [survey_id]
    );

    if (responseDetails.length === 0) {
      return res.status(200).json({ 
        message: "No survey responses found",
        survey_name: surveyName
      });
    }

    res.status(200).json({
      message: "Survey details fetched successfully",
      user_id,
      tenant_id,
      survey_name: surveyName,
      responses: responseDetails
    });

    await dynamicDB.end();
  } catch (error) {
    console.error("Error:", error);

    if (error.code === "ER_NO_SUCH_TABLE") {
      return res
        .status(200)
        .json({ message: "The table does not exist in the tenant database." });
    }

    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
});

// Download Excel
const { Parser } = require("json2csv");
router.get("/download_csv", verifyToken, async (req, res) => {
  try {
    const fields = ["Firstname", "Lastname", "Email", "PhoneNumber"];
    const data = []; 

    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(data);

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=heading_only.csv");

    res.status(200).send(csv);
  } catch (error) {
    console.error("Error generating CSV file:", error);
    res.status(500).send("Failed to generate CSV file");
  }
});

//Segment_email
router.get('/segment_email', verifyToken, async (req, res) => {
  const { tenant_id, user_id } = req.query;

  if (!tenant_id || !user_id) {
    return res.status(400).json({ error: 'tenant_id and user_id are required' });
  }
  try {
    const [tenantResult] = await db
      .query('SELECT tenant_name FROM nps_shared.nps_tenant WHERE tenant_id = ?', [tenant_id]);

    if (tenantResult.length === 0) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    const tenantDbName = `nps_${tenantResult[0].tenant_name}`;
    const [userResult] = await db

      .query('SELECT id FROM nps_users WHERE id = ?', [user_id]);

    if (userResult.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const [results] = await db
      .query(`
        SELECT 
          s.segment_name, 
          ec.email_id
        FROM ${tenantDbName}.nps_segments s
        LEFT JOIN ${tenantDbName}.nps_segment_tag_map stm ON s.segment_id = stm.segment_id
        LEFT JOIN ${tenantDbName}.nps_customer_tag_map ctm ON stm.tag_id = ctm.tag_id
        LEFT JOIN ${tenantDbName}.nps_external_contacts ec ON ctm.customer_id = ec.id
        WHERE ec.email_id IS NOT NULL
      `);

    if (results.length === 0) {
      return res.status(200).json({ error: 'No segments or emails found for this tenant' });
    }
    res.json({
      message: 'Segments and emails fetched successfully',
      data: results.map((result) => ({
        segment_name: result.segment_name,
        email_id: result.email_id,
      })),
      user_id,
      tenant_id,
    });

  } catch (error) {
    console.error('Error fetching segment data:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
});

// Get Recipient
router.get('/get_recipient', verifyToken, async (req, res) => {
  const { tenant_id, survey_id, user_id } = req.query;

  if (!tenant_id || !survey_id || !user_id) {
    return res.status(400).json({ error: 'tenant_id, survey_id, and user_id are required' });
  }

  try {
    const [tenantResult] = await db
      .query('SELECT tenant_name FROM nps_shared.nps_tenant WHERE tenant_id = ?', [tenant_id]);

    if (tenantResult.length === 0) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const tenantDbName = `nps_${tenantResult[0].tenant_name}`;

    const [userResult] = await db
      .query('SELECT id FROM nps_shared.nps_users WHERE id = ?', [user_id]);

    if (userResult.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const [recipients] = await db
      .query(
        `SELECT customer_mail, customer_id, email_status FROM ${tenantDbName}.nps_mail_schedule WHERE tenant_id = ? AND survey_id = ?`,
        [tenant_id, survey_id]
      );

    if (recipients.length === 0) {
      return res.status(404).json({ error: 'No records found in nps_mail_schedule for the provided survey_id' });
    }

    const surveyDetailsQuery = `
      SELECT survey_name 
      FROM ${tenantDbName}.csat_survey_detail 
      WHERE survey_id = ?;
    `;
    const [surveyDetails] = await db.query(surveyDetailsQuery, [survey_id]);

    if (surveyDetails.length === 0) {
      return res.status(404).json({ error: 'No matching survey found in csat_survey_detail' });
    }
    const surveyName = surveyDetails[0].survey_name;

    const results = [];

    for (const recipient of recipients) {
      const { customer_mail: emailId, customer_id: customerId, email_status } = recipient;

      let customerName = '';
      let status = '';

      // Determine the status based on email_status
      if (email_status === 'In progress') {
        status = 'In progress';
      } else if (email_status === 'Deleted') {
        status = 'Sent';
      } else if (email_status === 'Sent') {
        status = 'Sent';
      }

      const [contactRows] = await db
        .query(
          `SELECT firstname, lastname FROM ${tenantDbName}.nps_external_contacts WHERE id = ?`,
          [customerId]
        );

      if (contactRows.length > 0) {
        customerName = `${contactRows[0].firstname} ${contactRows[0].lastname}`;
      }

      results.push({
        survey_id,
        survey_name: surveyName,
        customer_name: customerName,
        email_id: emailId,
        status
      });
    }

    return res.json(results);
  } catch (error) {
    console.error('Error fetching recipient data:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
});

// GET Profile
router.get("/get_profile", verifyToken, async (req, res) => {
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ message: "ID is required" });
  }

  try {
    const [userResult] = await db
      .query(
        "SELECT firstname, lastname, email, phone_no, created_at FROM nps_shared.nps_users WHERE id = ?",
        [id]
      );

    if (userResult.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      message: "Profile fetched successfully",
      profile: userResult[0], 
    });
  } catch (error) {
    console.error("Error:", error);

    res.status(500).json({ message: "Internal server error", error: error.message });
  }
});

//Update Profile
router.put("/update_profile", verifyToken, async (req, res) => {
  const { id } = req.query;
  const {
    firstname,
    lastname,
    email,
    phone_no
  } = req.body; 

  if (!id) {
    return res.status(400).json({ message: "ID is required" });
  }
  if (
    !firstname &&
    !lastname &&
    !email &&
    !phone_no
  ) {
    return res.status(400).json({ message: "No fields provided to update" });
  }

  try {
    const [userResult] = await db
      .query("SELECT * FROM nps_shared.nps_users WHERE id = ?", [id]);

    if (userResult.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    const fields = [];
    const values = [];

    if (firstname) {
      fields.push("firstname = ?");
      values.push(firstname);
    }
    if (lastname) {
      fields.push("lastname = ?");
      values.push(lastname);
    }
    if (email) {
      fields.push("email = ?");
      values.push(email);
    }
    if (phone_no) {
      fields.push("phone_no = ?");
      values.push(phone_no);
    }
    values.push(id);
    const updateQuery = `UPDATE nps_shared.nps_users SET ${fields.join(
      ", "
    )} WHERE id = ?`;
    await db.query(updateQuery, values);

    res.status(200).json({ message: "Profile updated successfully" });
  } catch (error) {
    console.error("Error:", error);

    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
});

// Add Email details
router.post('/scheduleMail', verifyToken, async (req, res) => {
  const { survey, From, Name, subject, emailList, tenant_id, user_id, message } = req.body;

  if (!survey || !From || !Name || !emailList || !tenant_id || !user_id || !message) {
    return res.status(400).json({
      message: "Missing required fields: survey, From, Name, emailList, tenant_id, user_id, or message.",
    });
  }

  const validEmails = emailList.filter(email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
  if (validEmails.length === 0) {
    return res.status(400).json({ message: "Invalid email addresses provided." });
  }

  let dynamicDB;
  try {
    const [tenantResult] = await db
      .query(
        "SELECT tenant_name FROM nps_shared.nps_tenant WHERE tenant_id = ?",
        [tenant_id]
      );

    if (tenantResult.length === 0) {
      return res.status(404).json({ message: "Tenant not found." });
    }

    const tenantDbName = `nps_${tenantResult[0].tenant_name}`;
    dynamicDB = await dynamicDb(tenantDbName);

    const [userResult] = await db
      .query("SELECT id FROM nps_shared.nps_users WHERE id = ?", [user_id]);

    if (userResult.length === 0) {
      return res.status(404).json({ message: "User not found." });
    }

    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS nps_mail_schedule (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        survey_id INT NOT NULL,
        customer_id INT NOT NULL,
        customer_mail VARCHAR(250) NOT NULL,
        subject TEXT NOT NULL,
        from_id VARCHAR(250) NOT NULL,
        from_name VARCHAR(250) NOT NULL,
        mail BLOB NOT NULL,
        updated_by INT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        email_status ENUM('Sent', 'In progress', 'Deleted') DEFAULT 'In progress'
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    `;
    await dynamicDB.query(createTableQuery);

    const [contactList] = await dynamicDB.query(
      `SELECT id, email_id FROM nps_external_contacts WHERE email_id IN (?) AND status = 1`,
      [validEmails]
    );

    if (contactList.length === 0) {
      return res.status(404).json({ message: "No active contacts found." });
    }

    const emailData = [];
    const emailTemplatePath = path.join(__dirname, '..', 'views', 'email-template-survey.ejs');

    for (const contact of contactList) {
      try {
        const emailTemplate = await ejs.renderFile(emailTemplatePath, {
          userId: user_id,
          postdata: req.body,
          contactdata: contact,
          tenantdata: tenantResult[0],
        });

        emailData.push([
          tenant_id,
          survey,
          contact.id,
          contact.email_id,
          subject || "What did you think about CSAT",
          From,
          Name,
          emailTemplate,
          user_id,
        ]);
      } catch (templateError) {
        console.error(`Error rendering template for contact ID ${contact.id}:`, templateError);
        return res.status(500).json({ message: "Error rendering email template." });
      }
    }

    await dynamicDB.beginTransaction();

    const [insertResult] = await dynamicDB.query(
      `INSERT INTO nps_mail_schedule 
      (tenant_id, survey_id, customer_id, customer_mail, subject, from_id, from_name, mail, updated_by) 
      VALUES ?`,
      [emailData]
    );

    if (insertResult.affectedRows === 0) {
      throw new Error("Failed to schedule emails.");
    }

    await dynamicDB.query(
      `UPDATE csat_survey_detail SET sent_status = 1 WHERE survey_id = ?`,
      [survey]
    );

    const emailListData = emailData.map(item => [
      item[1], 
      user_id,
      item[4], 
      validEmails.join(', '),
      message,
    ]);

    const [sharedInsertResult] = await db.query(
      `INSERT INTO nps_shared.nps_email_send_list 
      (survey_id, user_id, subject, email_list, message) 
      VALUES ?`,
      [emailListData]
    );

    if (sharedInsertResult.affectedRows === 0) {
      throw new Error("Failed to copy data to shared email list.");
    }

    await dynamicDB.commit();

    res.status(200).json({
      message: "Emails successfully scheduled and copied to the shared email list.",
      scheduledCount: insertResult.affectedRows,
    });
  } catch (error) {
    if (dynamicDB) {
      await dynamicDB.rollback();
    }
    console.error("Error scheduling emails:", error);
    res.status(500).json({
      message: "An error occurred while scheduling emails.",
      error: error.message,
    });
  } finally {
    if (dynamicDB) {
      await dynamicDB.end();
    }
  }
});

module.exports = router;
