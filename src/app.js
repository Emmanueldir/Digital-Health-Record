const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const authRoutes = require("./routes/authRoutes");
const patientRoutes = require("./routes/patientRoutes");
const medicalRecordRoutes = require("./routes/medicalRecordRoutes");
const careTeamRoutes = require("./routes/careTeamRoutes");
const vitalsRoutes = require("./routes/vitalsRoutes");
const labRoutes = require("./routes/labRoutes");
const auditRoutes = require("./routes/auditRoutes");
const breakGlassRoutes = require("./routes/breakGlassRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const roleRoutes = require("./routes/roleRoutes");
const permissionRoutes = require("./routes/permissionRoutes");
const userRoleRoutes = require("./routes/userRoleRoutes");
const errorHandler = require("./middleware/errorHandler");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(helmet());
app.use(morgan("dev"));

app.get("/", (req, res) => {
    res.json({ message: "Digital Health Record API Running" });
});

// routes
app.use("/api/auth", authRoutes);
app.use("/api/patients", patientRoutes);
app.use("/api/records", medicalRecordRoutes);
app.use("/api/care-team", careTeamRoutes);
app.use("/api/vitals", vitalsRoutes);
app.use("/api/labs", labRoutes);
app.use("/api/audit", auditRoutes);
app.use("/api/break-glass", breakGlassRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/permissions", permissionRoutes);
app.use("/api/users", userRoleRoutes);
app.use("/app", express.static("frontend"));

app.use(errorHandler);

module.exports = app;
