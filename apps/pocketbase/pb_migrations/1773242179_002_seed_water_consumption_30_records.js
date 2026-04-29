/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("water_consumption");

  const record0 = new Record(collection);
    record0.set("userId", "test_user_001");
    record0.set("consumption_liters", 45.5);
    record0.set("consumption_date", "2024-12-01");
    record0.set("period", "daily");
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
    record1.set("consumption_liters", 52.3);
    record1.set("consumption_date", "2024-12-02");
    record1.set("period", "daily");
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
    record2.set("consumption_liters", 38.7);
    record2.set("consumption_date", "2024-12-03");
    record2.set("period", "daily");
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
    record3.set("consumption_liters", 61.2);
    record3.set("consumption_date", "2024-12-04");
    record3.set("period", "daily");
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
    record4.set("consumption_liters", 48.9);
    record4.set("consumption_date", "2024-12-05");
    record4.set("period", "daily");
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
    record5.set("consumption_liters", 55.4);
    record5.set("consumption_date", "2024-12-06");
    record5.set("period", "daily");
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
    record6.set("consumption_liters", 42.1);
    record6.set("consumption_date", "2024-12-07");
    record6.set("period", "daily");
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
    record7.set("consumption_liters", 67.8);
    record7.set("consumption_date", "2024-12-08");
    record7.set("period", "daily");
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
    record8.set("consumption_liters", 51.6);
    record8.set("consumption_date", "2024-12-09");
    record8.set("period", "daily");
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
    record9.set("consumption_liters", 44.3);
    record9.set("consumption_date", "2024-12-10");
    record9.set("period", "daily");
  try {
    app.save(record9);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record10 = new Record(collection);
    record10.set("userId", "test_user_001");
    record10.set("consumption_liters", 58.9);
    record10.set("consumption_date", "2024-12-11");
    record10.set("period", "daily");
  try {
    app.save(record10);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record11 = new Record(collection);
    record11.set("userId", "test_user_001");
    record11.set("consumption_liters", 46.5);
    record11.set("consumption_date", "2024-12-12");
    record11.set("period", "daily");
  try {
    app.save(record11);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record12 = new Record(collection);
    record12.set("userId", "test_user_001");
    record12.set("consumption_liters", 53.2);
    record12.set("consumption_date", "2024-12-13");
    record12.set("period", "daily");
  try {
    app.save(record12);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record13 = new Record(collection);
    record13.set("userId", "test_user_001");
    record13.set("consumption_liters", 39.8);
    record13.set("consumption_date", "2024-12-14");
    record13.set("period", "daily");
  try {
    app.save(record13);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record14 = new Record(collection);
    record14.set("userId", "test_user_001");
    record14.set("consumption_liters", 62.4);
    record14.set("consumption_date", "2024-12-15");
    record14.set("period", "daily");
  try {
    app.save(record14);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record15 = new Record(collection);
    record15.set("userId", "test_user_001");
    record15.set("consumption_liters", 49.7);
    record15.set("consumption_date", "2024-12-16");
    record15.set("period", "daily");
  try {
    app.save(record15);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record16 = new Record(collection);
    record16.set("userId", "test_user_001");
    record16.set("consumption_liters", 56.1);
    record16.set("consumption_date", "2024-12-17");
    record16.set("period", "daily");
  try {
    app.save(record16);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record17 = new Record(collection);
    record17.set("userId", "test_user_001");
    record17.set("consumption_liters", 41.3);
    record17.set("consumption_date", "2024-12-18");
    record17.set("period", "daily");
  try {
    app.save(record17);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record18 = new Record(collection);
    record18.set("userId", "test_user_001");
    record18.set("consumption_liters", 68.5);
    record18.set("consumption_date", "2024-12-19");
    record18.set("period", "daily");
  try {
    app.save(record18);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record19 = new Record(collection);
    record19.set("userId", "test_user_001");
    record19.set("consumption_liters", 50.2);
    record19.set("consumption_date", "2024-12-20");
    record19.set("period", "daily");
  try {
    app.save(record19);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record20 = new Record(collection);
    record20.set("userId", "test_user_001");
    record20.set("consumption_liters", 45.9);
    record20.set("consumption_date", "2024-12-21");
    record20.set("period", "daily");
  try {
    app.save(record20);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record21 = new Record(collection);
    record21.set("userId", "test_user_001");
    record21.set("consumption_liters", 59.6);
    record21.set("consumption_date", "2024-12-22");
    record21.set("period", "daily");
  try {
    app.save(record21);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record22 = new Record(collection);
    record22.set("userId", "test_user_001");
    record22.set("consumption_liters", 47.4);
    record22.set("consumption_date", "2024-12-23");
    record22.set("period", "daily");
  try {
    app.save(record22);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record23 = new Record(collection);
    record23.set("userId", "test_user_001");
    record23.set("consumption_liters", 54.8);
    record23.set("consumption_date", "2024-12-24");
    record23.set("period", "daily");
  try {
    app.save(record23);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record24 = new Record(collection);
    record24.set("userId", "test_user_001");
    record24.set("consumption_liters", 40.6);
    record24.set("consumption_date", "2024-12-25");
    record24.set("period", "daily");
  try {
    app.save(record24);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record25 = new Record(collection);
    record25.set("userId", "test_user_001");
    record25.set("consumption_liters", 63.1);
    record25.set("consumption_date", "2024-12-26");
    record25.set("period", "daily");
  try {
    app.save(record25);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record26 = new Record(collection);
    record26.set("userId", "test_user_001");
    record26.set("consumption_liters", 48.3);
    record26.set("consumption_date", "2024-12-27");
    record26.set("period", "daily");
  try {
    app.save(record26);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record27 = new Record(collection);
    record27.set("userId", "test_user_001");
    record27.set("consumption_liters", 57.7);
    record27.set("consumption_date", "2024-12-28");
    record27.set("period", "daily");
  try {
    app.save(record27);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record28 = new Record(collection);
    record28.set("userId", "test_user_001");
    record28.set("consumption_liters", 43.9);
    record28.set("consumption_date", "2024-12-29");
    record28.set("period", "daily");
  try {
    app.save(record28);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record29 = new Record(collection);
    record29.set("userId", "test_user_001");
    record29.set("consumption_liters", 69.2);
    record29.set("consumption_date", "2024-12-30");
    record29.set("period", "daily");
  try {
    app.save(record29);
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
