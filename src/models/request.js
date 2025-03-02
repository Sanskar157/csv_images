const mongoose = require("mongoose");

const requestSchema = new mongoose.Schema({
  requestId: { type: String, required: true, unique: true },
  status: { 
    type: String, 
    enum: ["pending", "processing", "completed", "failed"], 
    default: "pending" 
  },
  webhookUrl: { type: String, required: false }, 
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Request", requestSchema);
