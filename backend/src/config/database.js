const { Sequelize } = require("sequelize");

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: "postgres",
  dialectOptions: {
    ssl: process.env.NODE_ENV === "production"
      ? { require: true, rejectUnauthorized: false }
      : false,
  },
  logging: false,
  pool: {
    max: 20,      // รองรับ concurrent request มากขึ้น
    min: 2,       // keep connections warm
    acquire: 10000, // fail fast แทนค้าง 30 วิ
    idle: 30000,
    evict: 10000,
  },
});

module.exports = { sequelize };
