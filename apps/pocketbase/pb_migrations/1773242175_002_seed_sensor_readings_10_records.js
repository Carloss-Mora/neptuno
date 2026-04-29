/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("sensor_readings");

  const record0 = new Record(collection);
    record0.set("userId", "test_user_001");
    record0.set("soil_humidity", 65);
    record0.set("temperature", 22.5);
    record0.set("water_level", 78);
  try {
    app.save(record0);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record1 = new Record(collection);
    record1.set("userId", "test_user_001");
    record1.set("soil_humidity", 58);
    record1.set("temperature", 23.1);
    record1.set("water_level", 72);
  try {
    app.save(record1);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record2 = new Record(collection);
    record2.set("userId", "test_user_001");
    record2.set("soil_humidity", 72);
    record2.set("temperature", 21.8);
    record2.set("water_level", 85);
  try {
    app.save(record2);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record3 = new Record(collection);
    record3.set("userId", "test_user_001");
    record3.set("soil_humidity", 45);
    record3.set("temperature", 24.2);
    record3.set("water_level", 55);
  try {
    app.save(record3);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record4 = new Record(collection);
    record4.set("userId", "test_user_001");
    record4.set("soil_humidity", 81);
    record4.set("temperature", 20.5);
    record4.set("water_level", 92);
  try {
    app.save(record4);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record5 = new Record(collection);
    record5.set("userId", "test_user_001");
    record5.set("soil_humidity", 52);
    record5.set("temperature", 22.9);
    record5.set("water_level", 68);
  try {
    app.save(record5);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record6 = new Record(collection);
    record6.set("userId", "test_user_001");
    record6.set("soil_humidity", 68);
    record6.set("temperature", 23.4);
    record6.set("water_level", 80);
  try {
    app.save(record6);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record7 = new Record(collection);
    record7.set("userId", "test_user_001");
    record7.set("soil_humidity", 75);
    record7.set("temperature", 21.2);
    record7.set("water_level", 88);
  try {
    app.save(record7);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record8 = new Record(collection);
    record8.set("userId", "test_user_001");
    record8.set("soil_humidity", 42);
    record8.set("temperature", 25.1);
    record8.set("water_level", 50);
  try {
    app.save(record8);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record9 = new Record(collection);
    record9.set("userId", "test_user_001");
    record9.set("soil_humidity", 88);
    record9.set("temperature", 19.8);
    record9.set("water_level", 95);
  try {
    app.save(record9);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }
}, (app) => {
  // Rollback: record IDs not known, manual cleanup needed
})
