const { Sequelize } = require("sequelize");
const logger = require("../utils/logger");

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT) || 5432,
    dialect: "postgres",
    logging: (msg) => logger.debug(msg),
    pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
    define: { underscored: true, timestamps: true },
  }
);

module.exports = { sequelize };
