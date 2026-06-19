const { Sequelize } = require("sequelize");

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: "postgres",
  dialectOptions: {
    ssl: process.env.NODE_ENV === "production"
      ? { require: true, rejectUnauthorized: false }
      : false,
  },
  logging: false,
  pool: { max: 5, min: 0, acquire: 30000, idle: 10000 },
});

module.exports = { sequelize };
