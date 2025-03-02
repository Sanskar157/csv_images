const mongoose = require("mongoose");

const imageSchema = new mongoose.Schema({
  requestId: { type: String, required: true }, 
  serialNumber: { type: Number, required: true },
  productName: { type: String, required: true },
  inputImages: { type: [String], required: true }, 
  outputImages: { type: [String] }, 
  status: { 
    type: String, 
    enum: ["pending", "processing", "completed", "failed"], 
    default: "pending" 
  },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Image", imageSchema);
